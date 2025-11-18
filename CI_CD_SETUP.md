# CI/CD Setup Guide for Ginraidee

This guide will help you set up a free CI/CD pipeline for your React Native Expo app using GitHub Actions and EAS (Expo Application Services).

## Prerequisites

1. **GitHub Account** (Free)
2. **Expo Account** (Free tier available at https://expo.dev)
3. **Node.js 18+** installed locally

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo credentials when prompted.

## Step 3: Configure Your Project

The project already has `eas.json` configured with three build profiles:

- **development**: For local development builds
- **preview**: For internal testing (APK for Android)
- **production**: For production releases

## Step 4: Initialize EAS Build

```bash
eas build:configure
```

This will link your project to your Expo account.

## Step 5: Get Your Expo Access Token

1. Go to https://expo.dev/accounts/[your-username]/settings/access-tokens
2. Click "Create Token"
3. Give it a name like "GitHub Actions"
4. Copy the generated token (you won't see it again!)

## Step 6: Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

   - **Name**: `EXPO_TOKEN`
   - **Value**: [Your Expo access token from Step 5]

## Step 7: Push to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit with CI/CD setup"

# Create repository on GitHub (via web interface)
# Then add remote and push
git remote add origin https://github.com/[username]/[repo-name].git
git push -u origin main
```

## Step 8: Trigger Your First Build

### GitHub Actions (Manual Trigger)

The workflows are configured to run manually via `workflow_dispatch`:

1. Go to your GitHub repository
2. Click on **Actions** tab
3. Select the workflow you want to run:
   - **EAS Build** - For production/development builds
   - **Preview Build** - For testing builds
4. Click **Run workflow**
5. Choose options:
   - **Platform**: `all`, `android`, or `ios`
   - **Profile** (EAS Build only): `production`, `preview`, or `development`
6. Click **Run workflow** button

### Local Build Options

You can also trigger builds from your computer:

```bash
# Build for Android only
eas build --platform android

# Build for iOS only
eas build --platform ios

# Build for both platforms
eas build --platform all

# Build with specific profile
eas build --platform all --profile preview
```

## Build Profiles Explained

### Development
```bash
eas build --profile development
```
- Creates a development build
- Includes developer tools
- For local testing

### Preview
```bash
eas build --profile preview
```
- Creates internal distribution build
- APK for Android (easier to share)
- For QA and testing

### Production
```bash
eas build --profile production
```
- Creates production-ready build
- For app store submission
- Auto-increments version

## Monitoring Builds

1. Check GitHub Actions tab in your repository
2. Visit https://expo.dev and go to your project
3. Click on "Builds" to see build status and download artifacts

## Free Tier Limits

**Expo EAS Free Tier includes:**
- 30 builds per month (across all platforms)
- Build time: Standard priority
- Unlimited development builds

**GitHub Actions Free Tier includes:**
- 2,000 minutes/month for private repos
- Unlimited for public repos

## Environment Variables

To add environment variables to your builds:

1. Update `eas.json` to include env variables:
```json
{
  "build": {
    "production": {
      "env": {
        "API_URL": "https://api.example.com"
      }
    }
  }
}
```

2. Or use Expo's secret management:
```bash
eas secret:create --name API_KEY --value your-secret-value --type string
```

## Troubleshooting

### Build Failed
- Check the build logs in Expo dashboard
- Ensure all dependencies are properly installed
- Verify your `app.json` and `eas.json` configurations

### GitHub Actions Failing
- Verify `EXPO_TOKEN` secret is set correctly
- Check that your Expo account has builds remaining
- Review GitHub Actions logs

### Can't Login to EAS
```bash
eas logout
eas login
```

## Advanced: Auto-Submit to Stores

To automatically submit builds to app stores:

1. Configure `eas.json` submit section
2. Add store credentials:
```bash
# For iOS
eas credentials

# For Android
# Add keystore and service account JSON
```

3. Update workflow to include submit:
```yaml
- name: Submit to Stores
  run: eas submit --platform all --non-interactive
```

## Next Steps

1. ✅ Set up continuous integration
2. ✅ Automated builds on push
3. 📱 Configure app signing
4. 🚀 Set up automatic store submission
5. 📊 Add automated testing
6. 🔔 Set up build notifications (Slack, Discord, etc.)

## Useful Commands

```bash
# View build status
eas build:list

# View build details
eas build:view [build-id]

# Cancel a build
eas build:cancel

# View project info
eas project:info

# Configure credentials
eas credentials
```

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [React Native Documentation](https://reactnative.dev)

## Support

For issues:
- Expo: https://forums.expo.dev
- GitHub Actions: https://github.community
- Project Issues: Create an issue in this repository
