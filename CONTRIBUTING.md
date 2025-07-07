# Contributing to MCP Server Debug Thinking

First off, thank you for considering contributing to MCP Server Debug Thinking! It's people like you that make this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem
- **Describe the exact steps which reproduce the problem** in as many details as possible
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs** if possible
- **Include your environment details** (OS, Node.js version, Claude Desktop version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior** and **explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these `beginner` and `help-wanted` issues:

- [Beginner issues](https://github.com/yourusername/mcp-server-debug-thinking/labels/beginner) - issues which should only require a few lines of code
- [Help wanted issues](https://github.com/yourusername/mcp-server-debug-thinking/labels/help%20wanted) - issues which should be a bit more involved

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Process

### Setting Up Your Development Environment

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/mcp-server-debug-thinking.git
   cd mcp-server-debug-thinking
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Start development mode:
   ```bash
   npm run dev
   ```

### Code Style

- We use TypeScript for type safety
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Write self-documenting code when possible

### Code Validation

- Ensure all code passes linting before submitting PR
- Test your changes with Claude Desktop

```bash
# Run linting
npm run lint

# Format code
npm run format

# Build the project
npm run build
```

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
Add pattern recognition for async/await errors

- Implement detection for common Promise rejection patterns
- Add learning mechanism for async error handling
- Update documentation with async debugging examples

Fixes #123
```

### Documentation

- Update README.md if you change functionality
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format
- Add JSDoc comments to new functions and classes
- Include examples in your documentation

## Project Structure

```
mcp-server-debug-thinking/
├── src/                # Source files
│   ├── index.ts       # Main server implementation
│   ├── types/         # TypeScript type definitions
│   ├── services/      # Core services (GraphService, GraphStorage)
│   └── utils/         # Utility functions
├── dist/               # Compiled JavaScript files
├── .github/            # GitHub specific files
│   ├── ISSUE_TEMPLATE/ # Issue templates
│   └── workflows/      # GitHub Actions
├── package.json        # Project metadata and dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project documentation
```

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a git tag: `git tag -a v1.0.0 -m "Release version 1.0.0"`
4. Push changes: `git push origin main --tags`
5. GitHub Actions will automatically publish to npm

## Recognition

Contributors will be recognized in the following ways:

- Added to the Contributors section in README.md
- Mentioned in release notes for significant contributions
- Given credit in commit messages and pull requests

## Questions?

Feel free to ask questions in:

- [GitHub Discussions](https://github.com/yourusername/mcp-server-debug-thinking/discussions)
- [GitHub Issues](https://github.com/yourusername/mcp-server-debug-thinking/issues)

Thank you for contributing to make debugging better for everyone! 🎉