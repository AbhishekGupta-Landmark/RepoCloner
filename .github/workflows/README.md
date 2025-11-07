# GitHub Actions - Automated Testing

## 🧪 .NET Unit Tests Workflow

This repository includes an automated testing workflow that runs unit tests whenever code is pushed to feature branches.

### When Does It Run?

The workflow triggers on:
- **Push to feature branches**: Any branch starting with `feature/`
- **Migration branches**: Branches like `KafkaToAzureServiceBusMigration_*` or `QuickMigrationAnalysis_*`
- **Pull requests**: To `main` or `master` branches

### What Does It Do?

1. **Setup Environment**
   - Checks out your code
   - Installs .NET SDK (versions 6.x, 7.x, 8.x)

2. **Build & Test**
   - Restores NuGet dependencies
   - Builds the solution in Release mode
   - Runs all unit tests with code coverage

3. **Generate Reports**
   - Creates test result reports (`.trx` format)
   - Generates code coverage reports
   - Posts test summary to PR comments
   - Creates downloadable artifacts

### Viewing Test Results

**On Pull Requests:**
- Test results appear as a comment on the PR
- ✅ Passed tests shown in green
- ❌ Failed tests shown in red with details

**On GitHub Actions Tab:**
1. Go to your repository → **Actions** tab
2. Click on the workflow run
3. View the test summary in the job output
4. Download test artifacts for detailed analysis

### Downloading Test Reports

After each run:
1. Go to the workflow run page
2. Scroll to **Artifacts** section
3. Download:
   - `test-results` - Full test execution results
   - `code-coverage` - Code coverage reports

### Test Report Format

The workflow generates `.trx` files (Visual Studio Test Results) which can be opened in:
- Visual Studio
- Visual Studio Code (with extensions)
- Azure DevOps
- Any TRX viewer

### Troubleshooting

**Tests Not Running?**
- Check if your project has test projects with `*Tests.csproj` files
- Ensure test projects reference `Microsoft.NET.Test.Sdk`, `xunit`, or `NUnit`

**Workflow Failing?**
- Check the workflow logs in GitHub Actions tab
- Verify all NuGet packages restore correctly
- Ensure test projects build successfully locally

### Customization

To modify the workflow, edit `.github/workflows/dotnet-tests.yml`:

```yaml
# Change .NET versions
dotnet-version: |
  8.x

# Change trigger branches
on:
  push:
    branches:
      - 'your-pattern/**'
```

### Test Coverage Thresholds

Currently, the workflow runs all tests without coverage thresholds. To add minimum coverage requirements, add this step:

```yaml
- name: Check code coverage
  run: |
    # Parse coverage.cobertura.xml and fail if below threshold
    # (Custom script or tool needed)
```

---

**Note:** This workflow is designed for .NET/C# projects using xUnit, NUnit, or MSTest frameworks.
