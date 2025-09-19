# 🤝 Contributing to PDF Master Angular

Thank you for your interest in contributing to PDF Master Angular! We welcome contributions from developers of all skill levels. This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Contribution Guidelines](#contribution-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Community Support](#community-support)

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Experience level
- Gender, gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Body size
- Race, ethnicity, or religion
- Technology choices

### Expected Behavior

- **Be respectful**: Treat all community members with kindness and respect
- **Be collaborative**: Help others and ask for help when needed
- **Be inclusive**: Welcome newcomers and help them get involved
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Remember that everyone has different experience levels

### Unacceptable Behavior

- Harassment, trolling, or discriminatory language
- Personal attacks or insults
- Publishing private information without permission
- Spam, self-promotion, or off-topic discussions
- Any conduct that would be inappropriate in a professional setting

## 🚀 Getting Started

### Before You Start

1. **Read the documentation**: Familiarize yourself with the project structure and features
2. **Check existing issues**: See if your idea or bug report already exists
3. **Join the discussion**: Engage with the community in GitHub Discussions
4. **Start small**: Consider tackling beginner-friendly issues first

### Ways to Contribute

- 🐛 **Bug Reports**: Help us identify and fix issues
- ✨ **Feature Requests**: Suggest new functionality or improvements
- 📝 **Documentation**: Improve guides, comments, and explanations
- 🧪 **Testing**: Add test coverage or test new features
- 🎨 **UI/UX**: Enhance the user interface and experience
- 🔧 **Code**: Implement bug fixes, features, or optimizations
- 🌍 **Translations**: Help make PDF Master accessible in more languages

## 🛠️ Development Process

### Branch Strategy

- **main**: Production-ready code (protected)
- **develop**: Integration branch for new features
- **feature/\***: Individual feature branches
- **bugfix/\***: Bug fix branches
- **hotfix/\***: Critical production fixes

### Workflow

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally
3. **Create** a feature branch from `develop`
4. **Make** your changes with proper commits
5. **Test** your changes thoroughly
6. **Push** to your fork and create a Pull Request

## 📝 Contribution Guidelines

### Issue First Policy

For significant changes:
1. **Create an issue** describing the problem or enhancement
2. **Wait for discussion** and maintainer approval
3. **Reference the issue** in your Pull Request

### Types of Contributions

#### 🐛 Bug Fixes
- Include steps to reproduce the bug
- Provide expected vs. actual behavior
- Add tests to prevent regression
- Keep changes minimal and focused

#### ✨ New Features
- Discuss the feature in an issue first
- Follow existing patterns and conventions
- Include comprehensive tests
- Update documentation as needed

#### 📚 Documentation
- Fix typos, clarify instructions
- Add examples and use cases
- Improve code comments
- Update README or guides

#### 🧪 Tests
- Add missing test coverage
- Improve existing test quality
- Add integration or e2e tests
- Test edge cases and error conditions

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] Branch is up to date with target branch

### PR Requirements

1. **Clear Title**: Descriptive summary of changes
2. **Detailed Description**: Explain what and why
3. **Issue Reference**: Link related issues
4. **Screenshots**: For UI changes (before/after)
5. **Testing Notes**: How to test the changes
6. **Breaking Changes**: List any breaking changes

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Manual testing by reviewers
4. **Discussion**: Address feedback and suggestions
5. **Approval**: Maintainer approval required for merge

### Merge Requirements

- ✅ All CI checks pass
- ✅ Code review approved
- ✅ No merge conflicts
- ✅ Branch protection rules satisfied
- ✅ Maintainer approval

## 🐛 Issue Reporting

### Bug Reports

Use our bug report template and include:

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to...
2. Click on...
3. See error...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., Windows 10, macOS 12]
- Browser: [e.g., Chrome 96, Firefox 95]
- Version: [e.g., v1.2.3]

**Screenshots**
Add screenshots if applicable

**Additional Context**
Any other relevant information
```

### Feature Requests

Include:
- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives**: What other solutions did you consider?
- **Use Cases**: Who would benefit from this feature?

## 💻 Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- Modern IDE (VS Code recommended)

### Local Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/pdf-master.git
cd pdf-master-angular

# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Development Commands

```bash
# Development server
ng serve

# Generate components
ng generate component component-name

# Run tests
ng test

# Run linting
ng lint

# Build application
ng build

# Run e2e tests
ng e2e
```

## 📏 Coding Standards

### General Guidelines

- **TypeScript**: Use strict typing, avoid `any`
- **Angular**: Follow Angular style guide and best practices
- **RxJS**: Use reactive patterns appropriately
- **Testing**: Write unit and integration tests
- **Performance**: Consider performance implications

### Code Style

- **Formatting**: Use Prettier (configured in project)
- **Linting**: Follow ESLint rules (configured in project)
- **Naming**: Use descriptive, camelCase naming
- **Comments**: Document complex logic and public APIs
- **Imports**: Organize imports logically

### File Structure

```typescript
// Component example
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss']
})
export class ExampleComponent implements OnInit {
  // Properties first
  public title = 'Example';
  private readonly service = inject(ExampleService);

  // Lifecycle hooks
  ngOnInit(): void {
    this.initialize();
  }

  // Public methods
  public handleClick(): void {
    // Implementation
  }

  // Private methods
  private initialize(): void {
    // Implementation
  }
}
```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(annotations): add ellipse drawing support
fix(pdf-engine): resolve circle rendering issue
docs(readme): update installation instructions
```

## 🤗 Community Support

### Getting Help

- 📖 **Documentation**: Check the project wiki and README
- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Issues**: Report bugs via GitHub Issues
- 📧 **Direct Contact**: Reach out to maintainers for urgent matters

### Recognition

Contributors are recognized through:
- 🏆 **Contributor list**: Added to README
- 🎖️ **GitHub profile**: Contributions show on your profile
- 📈 **Project growth**: Help shape the project's future
- 🌟 **Community impact**: Make a difference for users worldwide

### Maintainer Responsibilities

- Review pull requests promptly
- Provide constructive feedback
- Maintain project quality standards
- Support community members
- Make final decisions on direction

## 📞 Contact

- **Project Maintainer**: [Nitendra Singh Yadav](https://github.com/Nitendra-singh-yadav)
- **Project Repository**: [PDF Master Angular](https://github.com/Nitendra-singh-yadav/pdf-master)
- **Issues**: [GitHub Issues](https://github.com/Nitendra-singh-yadav/pdf-master/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Nitendra-singh-yadav/pdf-master/discussions)

## 🙏 Thank You

Your contributions make PDF Master Angular better for everyone. Whether you fix a typo, add a feature, or help other users, every contribution matters!

---

<div align="center">
  <strong>Happy Contributing! 🎉</strong>
  <br>
  <sub>Together, we make PDF Master Angular amazing</sub>
</div>