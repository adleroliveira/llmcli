# Bedrock CLI

## Description

The Bedrock CLI is a command-line tool that allows you to interact with the Bedrock AI model. It provides various tools and capabilities to help you accomplish tasks, such as file management, directory listing, and more.

## Author

Adler Oliveira

## Getting Started

1. Install the necessary dependencies by running `npm install` in your project directory.
2. Configure your AWS credentials and Bedrock model access by running `npm run configure` or `npm run config`.
3. Once the configuration is set up, you can start the CLI by running `npm start`.

## Usage

The Bedrock CLI provides the following commands:

- `configure` or `config`: Sets up your AWS credentials and Bedrock model access.
- `cleanup`: Removes all saved configurations, credentials, and cached data.

When you start the CLI without any command, it will automatically validate your configuration and credentials, and then launch the interactive CLI session. In the CLI, you can use the following tools:

- `displayFiles`: Displays files and directories in the current working directory.
- `getFiles`: Returns a list of files and directories for LLM processing.
- `readFile`: Reads and returns the contents of a file in the current directory.
- `writeFile`: Creates a new file or overwrites an existing file in the current directory.

## Contributing

If you would like to contribute to this project, please follow the guidelines outlined in the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the [MIT License](LICENSE).
