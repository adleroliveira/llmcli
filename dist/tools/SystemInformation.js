import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { ToolBuilder } from "../ToolBuilder.js";
const execAsync = promisify(exec);
// Helper function to format bytes to human readable format
const formatBytes = (bytes) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
};
// Helper function to format uptime
const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${minutes}m`;
};
// Helper function to display system information
const displaySystemInfo = (systemInfo) => {
    console.log("\n📊 System Information Report\n");
    // Basic System Info
    console.log("🖥️  Basic System Information:");
    console.log(`    Hostname:    ${systemInfo.hostname}`);
    console.log(`    Platform:    ${systemInfo.platform}`);
    console.log(`    Architecture: ${systemInfo.arch}`);
    console.log(`    Uptime:      ${formatUptime(systemInfo.uptime)}`);
    console.log(`    Timestamp:   ${systemInfo.timestamp}`);
    // CPU Info
    console.log("\n💻 CPU Information:");
    console.log(`    Cores:       ${systemInfo.cpuInfo.cores}`);
    console.log(`    Model:       ${systemInfo.cpuInfo.model}`);
    // Memory Info
    console.log("\n🧠 Memory Information:");
    console.log(`    Total:       ${formatBytes(systemInfo.memory.total)}`);
    console.log(`    Used:        ${formatBytes(systemInfo.memory.used)}`);
    console.log(`    Free:        ${formatBytes(systemInfo.memory.free)}`);
    console.log(`    Usage:       ${systemInfo.memory.percentUsed.toFixed(2)}%`);
    // Disk Info (if available)
    if (systemInfo.disk) {
        console.log("\n💾 Disk Information:");
        console.log(`    Total:       ${systemInfo.disk.total}`);
        console.log(`    Used:        ${systemInfo.disk.used}`);
        console.log(`    Free:        ${systemInfo.disk.free}`);
        console.log(`    Usage:       ${systemInfo.disk.percentUsed}%`);
    }
    // Network Info (if available)
    if (systemInfo.network) {
        console.log("\n🌐 Network Interfaces:");
        systemInfo.network.interfaces.forEach((iface, index) => {
            console.log(`    Interface ${index + 1}:`);
            console.log(`        Name:    ${iface.interface}`);
            console.log(`        IP:      ${iface.ip}`);
        });
    }
    console.log("\n"); // Add final newline for cleaner output
};
export const createSystemInfoTool = () => {
    return new ToolBuilder("getSystemInfo")
        .describe("Retrieve and display comprehensive system information")
        .input("detailed", "boolean", "Include more detailed system information", false)
        .handle(async ({ detailed = false }) => {
        try {
            // Basic system information
            const systemInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                timestamp: new Date().toISOString(),
                cpuInfo: {
                    cores: os.cpus().length,
                    model: os.cpus()[0].model,
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
                },
            };
            // Additional detailed information if requested
            if (detailed) {
                try {
                    // Disk space information with platform-specific handling
                    if (os.platform() === "win32") {
                        const { stdout: diskInfo } = await execAsync("wmic logicaldisk get size,freespace,caption");
                        const diskLines = diskInfo.trim().split("\n").slice(1);
                        if (diskLines.length > 0) {
                            const diskLine = diskLines[0].trim().split(/\s+/);
                            const total = parseInt(diskLine[1]);
                            const free = parseInt(diskLine[2]);
                            const used = total - free;
                            systemInfo.disk = {
                                total: `${Math.round(total / (1024 * 1024 * 1024))}G`,
                                used: `${Math.round(used / (1024 * 1024 * 1024))}G`,
                                free: `${Math.round(free / (1024 * 1024 * 1024))}G`,
                                percentUsed: Math.round((used / total) * 100),
                            };
                        }
                    }
                    else {
                        const { stdout: diskInfo } = await execAsync("df -h /");
                        const diskLines = diskInfo.trim().split("\n");
                        if (diskLines.length >= 2) {
                            const diskData = diskLines[1].trim().split(/\s+/);
                            systemInfo.disk = {
                                total: diskData[1],
                                used: diskData[2],
                                free: diskData[3],
                                percentUsed: parseInt(diskData[4].replace("%", "")),
                            };
                        }
                    }
                    // Network interfaces with platform-specific handling
                    if (os.platform() === "win32") {
                        const { stdout: networkInfo } = await execAsync("ipconfig");
                        const interfaces = [];
                        let currentInterface = "";
                        networkInfo.split("\n").forEach((line) => {
                            const adapterMatch = line.match(/^Ethernet adapter (.+):/);
                            const ipMatch = line.match(/IPv4 Address[.\s]+: (.+)/);
                            if (adapterMatch) {
                                currentInterface = adapterMatch[1].trim();
                            }
                            else if (ipMatch && currentInterface) {
                                interfaces.push({
                                    ip: ipMatch[1].trim(),
                                    interface: currentInterface,
                                });
                            }
                        });
                        systemInfo.network = { interfaces };
                    }
                    else {
                        const { stdout: networkInfo } = await execAsync("ip addr");
                        const networkInterfaces = networkInfo
                            .split("\n")
                            .filter((line) => line.includes("inet ") && !line.includes("127.0.0.1"))
                            .map((line) => {
                            const parts = line.trim().split(/\s+/);
                            return {
                                ip: parts[1].split("/")[0],
                                interface: parts[parts.length - 1],
                            };
                        });
                        systemInfo.network = { interfaces: networkInterfaces };
                    }
                }
                catch (detailedError) {
                    console.error("Detailed information error:", detailedError);
                    console.warn("Could not retrieve all detailed system information");
                }
            }
            // Display the information to console
            displaySystemInfo(systemInfo);
            return {
                success: true,
                systemInfo,
            };
        }
        catch (error) {
            throw new Error(`System information retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    });
};
