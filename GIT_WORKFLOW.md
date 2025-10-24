# Git Workflow & Team Collaboration Guide

## 📋 Overview

This guide explains the complete Git workflow for a **3-developer team** working on separate modules, including merge strategies and Node.js dependency management.

---

## 🌳 Branching Strategy

```
main (production)
  │
  └─── develop (integration branch)
         │
         ├─── feature/dev1-auth-user (Developer 1)
         │
         ├─── feature/dev2-game-websocket (Developer 2)
         │
         └─── feature/dev3-blockchain-wallet (Developer 3)
```

### Branch Structure

- **`main`** - Production-ready code (protected)
- **`develop`** - Integration branch (all features merge here first)
- **`feature/dev1-*`** - Developer 1's feature branches
- **`feature/dev2-*`** - Developer 2's feature branches
- **`feature/dev3-*`** - Developer 3's feature branches

---

## 🚀 Initial Setup (Project Manager)

### Step 1: Create Repository

```bash
# Navigate to project root
cd D:\team3

# Initialize Git (if not already done)
git init

# Create .gitignore (already exists)
# Ensure these are in .gitignore:
# node_modules/
# .env
# dist/
# *.log

# Initial commit
git add .
git commit -m "Initial project setup: Complete backend structure"

# Create remote repository on GitHub/GitLab
# Follow platform instructions to add remote
git remote add origin https://github.com/your-org/seka-svara-backend.git

# Push to main
git push -u origin main
```

### Step 2: Create Develop Branch

```bash
# Create and switch to develop branch
git checkout -b develop

# Push develop branch
git push -u origin develop

# Set develop as default branch on GitHub/GitLab (recommended)
```

### Step 3: Protect Important Branches

On GitHub/GitLab, protect these branches:
- **main** - Require pull requests, require reviews
- **develop** - Require pull requests (optional: require reviews)

---

## 👥 Developer Setup (All Developers)

### First Time Setup

```bash
# Clone repository
git clone https://github.com/your-org/seka-svara-backend.git
cd seka-svara-backend/backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Verify everything works
npm run start:dev
```

### Configure Git

```bash
# Set your identity
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Set default branch
git config pull.rebase false

# View configuration
git config --list
```

---

## 🔨 Daily Workflow for Each Developer

### Developer 1: Authentication & User Management

```bash
# 1. Make sure you're on develop and it's up to date
git checkout develop
git pull origin develop

# 2. Create your feature branch
git checkout -b feature/dev1-auth-user

# 3. Work on your modules
# - src/modules/auth/
# - src/modules/users/
# - src/modules/admin/
# - src/modules/notifications/

# 4. Check what you've changed
git status

# 5. Stage your changes (ONLY YOUR MODULES)
git add src/modules/auth/
git add src/modules/users/
git add src/modules/admin/
git add src/modules/notifications/
git add src/common/guards/
git add src/common/decorators/

# 6. Commit with descriptive message
git commit -m "feat(auth): Implement JWT authentication and user registration"

# 7. Push to your branch
git push origin feature/dev1-auth-user

# 8. Continue working...
# Repeat steps 4-7 as you make progress

# 9. When ready, create Pull Request on GitHub/GitLab
# Target: develop branch
```

### Developer 2: Game Logic & Real-time

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create your feature branch
git checkout -b feature/dev2-game-websocket

# 3. Work on your modules
# - src/modules/game/
# - src/modules/tables/
# - src/modules/websocket/
# - src/modules/leaderboard/

# 4. Stage and commit YOUR changes only
git add src/modules/game/
git add src/modules/tables/
git add src/modules/websocket/
git add src/modules/leaderboard/

git commit -m "feat(game): Implement Seka Svara game engine and WebSocket gateway"

# 5. Push to your branch
git push origin feature/dev2-game-websocket
```

### Developer 3: Blockchain & Wallet

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create your feature branch
git checkout -b feature/dev3-blockchain-wallet

# 3. Work on your modules
# - src/modules/blockchain/
# - src/modules/wallet/
# - src/modules/transactions/
# - src/modules/nft/
# - src/contracts/

# 4. Stage and commit YOUR changes only
git add src/modules/blockchain/
git add src/modules/wallet/
git add src/modules/transactions/
git add src/modules/nft/
git add src/contracts/

git commit -m "feat(blockchain): Implement BSC and Tron USDT integration"

# 5. Push to your branch
git push origin feature/dev3-blockchain-wallet
```

---

## 🔄 Integration Process (Project Manager)

### Scenario 1: First Developer Merges (Easy)

**Developer 1 finishes first:**

```bash
# Developer 1 creates Pull Request: feature/dev1-auth-user → develop
# Project Manager reviews on GitHub/GitLab

# If approved, merge on GitHub (click "Merge Pull Request")
# OR via command line:

git checkout develop
git pull origin develop

# Merge Developer 1's branch
git merge feature/dev1-auth-user --no-ff

# Resolve any conflicts (unlikely for first merge)

# Push to develop
git push origin develop

# Delete feature branch (optional)
git branch -d feature/dev1-auth-user
git push origin --delete feature/dev1-auth-user
```

### Scenario 2: Second Developer Merges

**Developer 2 finishes:**

```bash
# Developer 2 updates their branch with latest develop
git checkout feature/dev2-game-websocket
git pull origin develop  # Pull latest changes from develop

# Resolve any conflicts (see conflict resolution section below)

# Push updated branch
git push origin feature/dev2-game-websocket

# Create Pull Request: feature/dev2-game-websocket → develop
# Project Manager reviews and merges

git checkout develop
git pull origin develop
git merge feature/dev2-game-websocket --no-ff
git push origin develop
```

### Scenario 3: Third Developer Merges

**Developer 3 finishes:**

```bash
# Developer 3 updates their branch
git checkout feature/dev3-blockchain-wallet
git pull origin develop  # Get all previous merges

# Resolve any conflicts
# Test everything works together

# Push and create Pull Request
git push origin feature/dev3-blockchain-wallet

# Project Manager merges
git checkout develop
git pull origin develop
git merge feature/dev3-blockchain-wallet --no-ff
git push origin develop
```

---

## ⚠️ Handling Merge Conflicts

### Common Conflict: package.json

**Scenario:** Two developers install different packages.

**Developer 1 adds:**
```json
"dependencies": {
  "@nestjs/passport": "^10.0.3",
  "passport-jwt": "^4.0.1"
}
```

**Developer 2 adds:**
```json
"dependencies": {
  "socket.io": "^4.6.0",
  "@nestjs/websockets": "^10.3.0"
}
```

**Conflict Resolution:**

```bash
# When pulling develop or merging
git pull origin develop

# Git will show conflict in package.json
# CONFLICT (content): Merge conflict in backend/package.json

# Open package.json
code package.json

# You'll see:
<<<<<<< HEAD
  "dependencies": {
    "@nestjs/passport": "^10.0.3",
    "passport-jwt": "^4.0.1"
=======
  "dependencies": {
    "socket.io": "^4.6.0",
    "@nestjs/websockets": "^10.3.0"
>>>>>>> feature/dev2-game-websocket

# SOLUTION: Manually merge both sets
  "dependencies": {
    "@nestjs/passport": "^10.0.3",
    "passport-jwt": "^4.0.1",
    "socket.io": "^4.6.0",
    "@nestjs/websockets": "^10.3.0"
  }

# Save the file

# Reinstall dependencies
npm install

# This generates new package-lock.json

# Mark conflict as resolved
git add package.json package-lock.json

# Complete the merge
git commit -m "Merge: Resolved package.json dependencies conflict"

# Test that everything works
npm run start:dev

# Push
git push origin develop
```

### Common Conflict: app.module.ts

**Scenario:** Multiple developers import their modules.

**Developer 1:**
```typescript
imports: [
  AuthModule,
  UsersModule,
  AdminModule,
]
```

**Developer 2:**
```typescript
imports: [
  GameModule,
  TablesModule,
  WebsocketModule,
]
```

**Resolution:**

```bash
# Conflict in app.module.ts
code src/app.module.ts

# Merge both imports
imports: [
  ConfigModule.forRoot({ ... }),
  TypeOrmModule.forRootAsync({ ... }),
  // Developer 1 modules
  AuthModule,
  UsersModule,
  AdminModule,
  NotificationsModule,
  // Developer 2 modules
  GameModule,
  TablesModule,
  WebsocketModule,
  LeaderboardModule,
]

# Save, test, commit
git add src/app.module.ts
git commit -m "Merge: Combined module imports"
npm run start:dev
```

---

## 📦 Node Modules Management

### Best Practices

#### 1. **Never Commit node_modules/**
```bash
# Already in .gitignore
node_modules/
```

#### 2. **Always Commit package.json and package-lock.json**
```bash
git add package.json package-lock.json
git commit -m "deps: Add new dependencies"
```

#### 3. **After Pulling Changes**
```bash
# Always run npm install after pulling
git pull origin develop
npm install  # Sync dependencies

# Or use this combined command
git pull origin develop && npm install
```

#### 4. **Handling Dependency Conflicts**

**When Both Developers Install Packages:**

```bash
# Developer 1
npm install @nestjs/passport passport-jwt bcrypt
git add package.json package-lock.json
git commit -m "deps: Add authentication packages"
git push

# Developer 2 (before pulling Developer 1's changes)
npm install socket.io @nestjs/websockets
git add package.json package-lock.json
git commit -m "deps: Add WebSocket packages"

# Developer 2 pulls and gets conflict
git pull origin develop
# CONFLICT in package.json and package-lock.json

# SOLUTION:
# 1. Accept both changes in package.json (manual merge)
# 2. Delete package-lock.json
rm package-lock.json

# 3. Reinstall to generate new lock file
npm install

# 4. Commit resolved files
git add package.json package-lock.json
git commit -m "Merge: Resolved dependency conflicts"
git push
```

### Dependency Version Conflicts

**Problem:** Same package, different versions

```json
// Developer 1
"typescript": "^5.3.3"

// Developer 2  
"typescript": "^5.2.2"
```

**Solution:**

```bash
# Choose the NEWER version (usually safest)
"typescript": "^5.3.3"

# Or use exact version to avoid issues
"typescript": "5.3.3"  # Remove ^

# Reinstall
npm install

# Test everything
npm run build
npm run start:dev
```

---

## 🎯 Merge Strategies

### Strategy 1: Sequential Merging (Recommended for Your Team)

**Order:** Dev 1 → Dev 2 → Dev 3

```bash
# Week 2: Developer 1 merges
git checkout develop
git merge feature/dev1-auth-user --no-ff
git push origin develop

# Week 3: Developer 2 updates and merges
# (Developer 2's branch)
git checkout feature/dev2-game-websocket
git pull origin develop  # Get Dev 1's changes
npm install  # Sync dependencies
# Resolve conflicts if any
git push origin feature/dev2-game-websocket

# (Project Manager merges)
git checkout develop
git merge feature/dev2-game-websocket --no-ff
git push origin develop

# Week 4: Developer 3 updates and merges
# (Developer 3's branch)
git checkout feature/dev3-blockchain-wallet
git pull origin develop  # Get Dev 1 & 2's changes
npm install
# Resolve conflicts
git push origin feature/dev3-blockchain-wallet

# (Project Manager merges)
git checkout develop
git merge feature/dev3-blockchain-wallet --no-ff
git push origin develop
```

### Strategy 2: Parallel Development with Regular Syncs

```bash
# Every Monday & Thursday: All developers sync

# Developer 1
git checkout feature/dev1-auth-user
git pull origin develop
npm install
# Resolve any conflicts
git push origin feature/dev1-auth-user

# Developer 2
git checkout feature/dev2-game-websocket
git pull origin develop
npm install
# Resolve any conflicts
git push origin feature/dev2-game-websocket

# Developer 3
git checkout feature/dev3-blockchain-wallet
git pull origin develop
npm install
# Resolve any conflicts
git push origin feature/dev3-blockchain-wallet
```

---

## 🔍 Conflict Resolution Checklist

### Before Merging

- [ ] All tests passing on your branch
- [ ] Code reviewed (if using PR reviews)
- [ ] Branch is up to date with develop
- [ ] Dependencies installed and working
- [ ] No linter errors

### During Conflict Resolution

1. **Identify conflict type:**
   - Code conflict (logic)
   - Dependency conflict (package.json)
   - Import conflict (module imports)

2. **For package.json conflicts:**
   ```bash
   # Merge both dependency lists
   # Keep higher version numbers
   # Delete package-lock.json
   rm package-lock.json
   npm install
   git add package.json package-lock.json
   ```

3. **For code conflicts:**
   ```bash
   # Open conflicted file
   code path/to/file.ts
   
   # Manually merge (keep both changes if possible)
   # Remove conflict markers (<<<<<<, ======, >>>>>>)
   # Test the merged code
   
   git add path/to/file.ts
   ```

4. **Test after resolving:**
   ```bash
   npm install
   npm run lint
   npm run build
   npm run start:dev
   # Verify functionality
   ```

5. **Complete merge:**
   ```bash
   git commit -m "Merge: Resolved conflicts between feature branches"
   git push
   ```

### After Merging

- [ ] All developers pull latest develop
- [ ] All developers run `npm install`
- [ ] All developers verify their features still work
- [ ] Integration testing

---

## 📋 Common Scenarios & Solutions

### Scenario 1: Two Developers Modify Same File

**Problem:** Both Dev 1 and Dev 2 modify `src/config/database.config.ts`

**Solution:**
```bash
# Project Manager merges Dev 1 first
git merge feature/dev1-auth-user

# When merging Dev 2
git merge feature/dev2-game-websocket
# CONFLICT in database.config.ts

# Open file and manually combine both changes
code src/config/database.config.ts

# Keep valid changes from both developers
# Test configuration
git add src/config/database.config.ts
git commit -m "Merge: Combined database config changes"
```

### Scenario 2: Circular Dependencies

**Problem:** Dev 2's GameModule needs Dev 3's WalletModule, but Dev 3 isn't done

**Solution:**
```bash
# Create interface/mock in shared location
# src/common/interfaces/wallet.interface.ts

export interface IWalletService {
  lockFunds(userId: string, amount: number): Promise<void>;
  unlockFunds(userId: string, amount: number): Promise<void>;
}

# Dev 2 uses interface
import { IWalletService } from '@common/interfaces/wallet.interface';

# Dev 3 implements interface later
export class WalletService implements IWalletService {
  // Implementation
}
```

### Scenario 3: Breaking Changes

**Problem:** Dev 1 changes User entity structure that Dev 2 depends on

**Solution:**
```bash
# 1. Communication! Dev 1 announces change
# 2. Dev 1 creates migration for database
npm run migration:generate -- src/database/migrations/UpdateUserEntity

# 3. Dev 2 pulls changes
git pull origin develop
npm install
npm run migration:run  # Apply database changes

# 4. Dev 2 updates their code to use new structure
# Update imports and usages

# 5. Test and commit
npm run start:dev
git add .
git commit -m "refactor: Update to use new User entity structure"
```

### Scenario 4: Environment Variables Conflict

**Problem:** Multiple developers add different env variables

**Developer 1 adds:**
```env
JWT_SECRET=secret1
JWT_EXPIRATION=7d
```

**Developer 2 adds:**
```env
WS_PORT=3001
WS_PATH=/socket.io
```

**Solution:**
```bash
# Update .env.example (not .env!)
# Merge all new variables

# .env.example
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d
WS_PORT=3001
WS_PATH=/socket.io

# Commit .env.example
git add .env.example
git commit -m "docs: Update environment variables template"

# Each developer updates their local .env (not committed)
cp .env.example .env
# Edit with actual values
```

---

## 🛠️ Useful Git Commands

### Checking Status

```bash
# See what you've changed
git status

# See detailed changes
git diff

# See changes for specific file
git diff src/modules/auth/auth.service.ts

# See commit history
git log --oneline --graph

# See who changed what
git blame src/modules/auth/auth.service.ts
```

### Undoing Changes

```bash
# Discard changes in working directory
git checkout -- src/modules/auth/auth.service.ts

# Unstage file (keep changes)
git reset HEAD src/modules/auth/auth.service.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) - DANGEROUS!
git reset --hard HEAD~1

# Revert a commit (safe)
git revert <commit-hash>
```

### Branch Management

```bash
# List all branches
git branch -a

# Switch branch
git checkout feature/dev1-auth-user

# Create and switch to new branch
git checkout -b feature/dev1-notifications

# Delete local branch
git branch -d feature/dev1-auth-user

# Delete remote branch
git push origin --delete feature/dev1-auth-user

# Rename branch
git branch -m old-name new-name
```

### Syncing

```bash
# Fetch remote changes (doesn't merge)
git fetch origin

# Pull changes from develop
git pull origin develop

# Push your branch
git push origin feature/dev1-auth-user

# Force push (DANGEROUS - avoid!)
git push --force origin feature/dev1-auth-user
```

### Stashing (Temporary Save)

```bash
# Save work in progress
git stash

# List stashes
git stash list

# Apply latest stash
git stash pop

# Apply specific stash
git stash apply stash@{0}

# Clear all stashes
git stash clear
```

---

## 📅 Weekly Workflow Example

### Monday: Sync Week

```bash
# Project Manager
- Review last week's progress
- Merge completed features to develop
- Update CHANGELOG.md

# All Developers
git checkout develop
git pull origin develop
git checkout feature/devX-module-name
git pull origin develop  # Sync with team changes
npm install
# Resolve conflicts if any
npm run start:dev  # Verify everything works
git push origin feature/devX-module-name
```

### Tuesday - Thursday: Development

```bash
# Each Developer
- Work on assigned modules
- Commit frequently with clear messages
- Push to their branch daily

git add .
git commit -m "feat(module): Implement feature X"
git push origin feature/devX-module-name
```

### Friday: Review & Integration

```bash
# Project Manager
- Review all Pull Requests
- Merge ready features to develop
- Test integration
- Plan next week

# Developers
- Create/update Pull Requests
- Code review for team members
- Update documentation
- Prepare demo (optional)
```

---

## 🚨 Emergency: Rollback

### Rollback Last Merge

```bash
# Find commit hash before merge
git log --oneline

# Reset to that commit
git reset --hard <commit-hash>

# Force push (DANGEROUS - use carefully!)
git push --force origin develop

# Better: Create revert commit
git revert <merge-commit-hash>
git push origin develop
```

### Recover Deleted Branch

```bash
# Find dangling commits
git reflog

# Recreate branch
git checkout -b recovered-branch <commit-hash>
```

---

## ✅ Best Practices

### DO:
- ✅ Commit often with clear messages
- ✅ Pull from develop regularly
- ✅ Run `npm install` after pulling
- ✅ Test before committing
- ✅ Use descriptive branch names
- ✅ Write good commit messages
- ✅ Keep commits focused (one feature/fix per commit)
- ✅ Communicate with team about changes

### DON'T:
- ❌ Commit node_modules/
- ❌ Commit .env files
- ❌ Force push to shared branches
- ❌ Commit without testing
- ❌ Modify other developers' modules without discussion
- ❌ Ignore merge conflicts
- ❌ Work directly on develop branch
- ❌ Commit large binary files

### Commit Message Format

```bash
# Good commit messages
git commit -m "feat(auth): Implement JWT authentication"
git commit -m "fix(game): Resolve turn order bug"
git commit -m "docs(readme): Update installation instructions"
git commit -m "refactor(wallet): Optimize balance calculation"
git commit -m "test(auth): Add unit tests for login"

# Format: type(scope): description

# Types:
# feat: New feature
# fix: Bug fix
# docs: Documentation
# style: Formatting
# refactor: Code refactoring
# test: Tests
# chore: Build/config
```

---

## 📞 When to Ask for Help

### Ask Project Manager When:
- Merge conflicts you can't resolve
- Breaking changes needed across modules
- Database schema changes
- Major refactoring needed
- Integration issues

### Coordinate with Team When:
- Modifying shared files (app.module.ts, config files)
- Adding new dependencies
- Changing entity structures
- Breaking API contracts
- Needing another developer's module

---

## 🎯 Success Checklist

### For Each Merge:
- [ ] Branch up to date with develop
- [ ] Dependencies installed (`npm install`)
- [ ] No linter errors (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] Tests passing (`npm run test`)
- [ ] Application starts (`npm run start:dev`)
- [ ] Your features working
- [ ] No console errors
- [ ] Documentation updated
- [ ] Pull Request created
- [ ] Code reviewed (if applicable)

---

## 📚 Additional Resources

- [Git Documentation](https://git-scm.com/doc)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 🆘 Quick Reference

```bash
# Daily workflow
git pull origin develop          # Get latest
npm install                      # Sync dependencies
# ... make changes ...
git add .                        # Stage changes
git commit -m "feat: message"   # Commit
git push origin your-branch      # Push

# Sync with team
git pull origin develop          # Pull latest develop
npm install                      # Sync dependencies
# Resolve conflicts if any
git push origin your-branch      # Push updated branch

# Create Pull Request
# Go to GitHub/GitLab and click "New Pull Request"
# Select: your-branch → develop

# After PR merged
git checkout develop             # Switch to develop
git pull origin develop          # Get merged changes
npm install                      # Sync dependencies
```

---

**Remember:** Communication is key! When in doubt, ask your team! 🤝

**Good luck with your collaborative development! 🚀**

