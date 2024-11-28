# LLMCLI - AWS Bedrock AI Assistant

## Description

LLMCLI is a command-line interface that enables interactive conversations with AWS Bedrock's AI models. It comes with built-in tools for file operations, command execution, and process management, making it a powerful assistant for various CLI tasks.

## Installation

You can install LLMCLI directly from GitHub:

```bash
npx github:adleroliveira/llmcli
```

Or install it globally:

```bash
npm install -g github:adleroliveira/llmcli
```

## Prerequisites

- AWS Account with Bedrock access enabled
- AWS credentials configured locally or AWS IAM role with appropriate permissions
- Node.js 18 or higher
- pnpm (recommended) or npm

## Commands

- `llmcli`: Starts an interactive AI assistant session
- `llmcli configure` or `llmcli config`: Configure AWS credentials and Bedrock settings
- `llmcli cleanup [-f|--force]`: Remove all saved configurations and cached data
- `llmcli --version`: Display the CLI version
- `llmcli --help`: Show help information

## Features

The CLI includes several built-in tools that the AI assistant can use:

### File Operations

- Directory listing and navigation
- File reading and writing capabilities
- File content analysis and manipulation

### Command Execution

- Execute shell commands through the AI assistant
- Background process management
- Graceful shutdown handling

### Interactive Experience

- Real-time command validation
- Progress indicators for long-running operations
- Helpful error messages and recovery options

## Configuration

On first run or when using `llmcli configure`, the tool will:

1. Validate AWS credentials
2. Check Bedrock model access
3. Set up necessary configurations
4. Store settings securely for future sessions

## Error Handling

The CLI includes comprehensive error handling:

- Automatic credential validation
- Interactive reconfiguration prompts
- Graceful process termination
- Background process cleanup

## Development

To work on the LLMCLI locally:

```bash
# Clone the repository
git clone https://github.com/adleroliveira/llmcli.git

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode
pnpm dev
```

## Security

LLMCLI requires AWS credentials to function. It's recommended to:

- Use AWS IAM roles when possible
- Restrict Bedrock model access appropriately
- Never commit credentials to version control
- Use AWS credential best practices

## License

ISC License

## Author

Adler Oliveira

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
