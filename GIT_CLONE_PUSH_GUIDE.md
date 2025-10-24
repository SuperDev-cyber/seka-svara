# Git Clone & Push Quick Guide
## For All Team Members

---

## 🎯 Purpose

This guide provides simple, step-by-step instructions for cloning the repository and pushing your changes. Perfect for quick reference!

---

## 📥 Initial Setup: Clone the Repository

### Step 1: Clone

```bash
# Navigate to where you want the project
cd D:\

# Clone the repository
git clone https://github.com/your-org/seka-svara-backend.git

# Navigate into the project
cd seka-svara-backend/backend
```

### Step 2: Configure Git

```bash
# Set your name
git config user.name "Your Full Name"

# Set your email
git config user.email "your.email@example.com"

# Verify settings
git config --list
```

### Step 3: Install Docker Desktop ⚠️ **REQUIRED**

**ALL DEVELOPERS MUST USE DOCKER** - Team requirement!

#### Windows:
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Run installer
3. Restart computer when prompted
4. Verify: `docker --version`

#### Mac:
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Drag to Applications folder
3. Launch Docker Desktop
4. Verify: `docker --version`

#### Linux:
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
docker --version
```

### Step 4: Start Database Services

```bash
# Navigate to backend folder
cd seka-svara-backend/backend

# Start PostgreSQL and Redis
docker-compose up -d

# Verify containers are running
docker ps

# You should see:
# - seka-svara-postgres
# - seka-svara-redis
```

### Step 5: Install Dependencies

```bash
# Install all Node.js packages
npm install

# Setup environment variables
cp .env.example .env
# Now edit .env with your settings (use notepad or VS Code)

# Run database migrations
npm run migration:run
```

### Step 6: Verify Setup

```bash
# Try starting the application
npm run start:dev

# If it works, you're ready to go! ✅
# You should see: "Application is running on: http://localhost:8000"
# Press Ctrl+C to stop
```

---

## 🌿 Create Your Feature Branch

**Important:** Never work directly on `main` or `develop` branches!

```bash
# Make sure you're on develop
git checkout develop

# Pull latest changes
git pull origin develop

# Create YOUR branch (use your developer number)
# Developer 1:
git checkout -b feature/dev1-auth-user

# Developer 2:
git checkout -b feature/dev2-game-websocket

# Developer 3:
git checkout -b feature/dev3-blockchain-wallet

# Push your new branch to GitHub/GitLab
git push -u origin feature/devX-module-name
```

---

## 💾 Daily Work: Commit & Push

### Basic Workflow

```bash
# 1. Check what you've changed
git status

# 2. See detailed changes
git diff

# 3. Add your changes
git add src/modules/your-module/

# Or add multiple folders
git add src/modules/auth/ src/modules/users/ src/common/guards/

# Or add specific files
git add src/modules/auth/auth.service.ts

# 4. Commit with a message
git commit -m "feat(auth): Implement user login"

# 5. Push to YOUR branch
git push origin feature/devX-module-name
```

### Quick One-Liner (after first push)

```bash
# Add, commit, and push in one go
git add . && git commit -m "feat: your message" && git push
```

---

## 📤 Git Push Examples

### Push After First Time Setup

```bash
# First time - creates remote branch
git push -u origin feature/dev1-auth-user

# After that, just use:
git push
```

### Push Specific Branch

```bash
# Explicitly specify branch
git push origin feature/dev1-auth-user
```

### Push After Adding Dependencies

```bash
# When you install new packages
npm install @nestjs/passport

# Commit both package files
git add package.json package-lock.json
git commit -m "deps: Add passport for authentication"
git push
```

### Push Multiple Commits

```bash
# Make first change
git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): Add login method"

# Make second change
git add src/modules/auth/auth.controller.ts
git commit -m "feat(auth): Add login endpoint"

# Push all commits at once
git push
```

---

## 🔄 Syncing With Team Changes

### Before Starting Work Each Day

```bash
# 1. Start Docker services (if not running)
docker-compose up -d

# 2. Verify services are running
docker ps

# 3. Switch to your branch
git checkout feature/devX-module-name

# 4. Pull latest changes from develop
git pull origin develop

# 5. Install any new dependencies
npm install

# 6. Start development server
npm run start:dev

# Start working!
```

### If You Forgot to Pull Before Working

```bash
# Save your current work
git stash

# Pull latest changes
git pull origin develop

# Restore your work
git stash pop

# Install dependencies
npm install
```

---

## 📋 Common Git Commands

### Checking Status

```bash
# See what changed
git status

# See detailed changes
git diff

# See what you're about to commit
git diff --staged

# See commit history
git log --oneline --graph

# See your current branch
git branch
```

### Adding Files

```bash
# Add all changes in current directory
git add .

# Add specific folder
git add src/modules/auth/

# Add specific file
git add src/modules/auth/auth.service.ts

# Add multiple items
git add src/modules/auth/ src/modules/users/ package.json
```

### Committing

```bash
# Commit with message
git commit -m "feat(auth): Implement JWT authentication"

# Commit all tracked changes (skips git add)
git commit -am "fix: Resolve login bug"

# Amend last commit (fix typo in message)
git commit --amend -m "feat(auth): Implement JWT authentication"
```

### Pushing

```bash
# Push to your branch (after first setup)
git push

# Push to specific branch
git push origin feature/dev1-auth-user

# Push and set upstream (first time)
git push -u origin feature/dev1-auth-user
```

### Pulling

```bash
# Pull from develop
git pull origin develop

# Pull from your branch
git pull origin feature/dev1-auth-user

# Pull current branch
git pull
```

---

## 🎯 Commit Message Guidelines

### Format

```
type(scope): description

Examples:
feat(auth): Add user registration
fix(game): Resolve turn order bug
docs(readme): Update installation steps
deps: Add WebSocket packages
refactor(wallet): Optimize balance calculation
test(auth): Add login tests
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **deps**: Dependency updates
- **refactor**: Code refactoring (no feature change)
- **test**: Adding tests
- **chore**: Build config, etc.
- **style**: Code formatting

### Good Examples

```bash
✅ git commit -m "feat(auth): Implement JWT authentication"
✅ git commit -m "fix(game): Resolve card dealing bug"
✅ git commit -m "deps: Add socket.io for real-time features"
✅ git commit -m "docs: Update API documentation"
```

### Bad Examples

```bash
❌ git commit -m "fix"                    # Too vague
❌ git commit -m "made changes"           # Not descriptive
❌ git commit -m "asdfasdf"              # Meaningless
❌ git commit -m "Fixed stuff"            # Not professional
```

---

## 🐳 Docker Quick Reference

### Daily Docker Commands

```bash
# Start services
docker-compose up -d

# Check if running
docker ps

# View logs
docker logs seka-svara-postgres
docker logs seka-svara-redis

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# Remove everything (deletes data!)
docker-compose down -v
```

### Docker Troubleshooting

**Problem:** "Cannot connect to Docker daemon"
```bash
# Solution: Start Docker Desktop application
# Wait for whale icon to be steady in taskbar
```

**Problem:** "Port 5432 already in use"
```bash
# Windows:
netstat -ano | findstr :5432
taskkill /PID <PID_NUMBER> /F

# Mac/Linux:
lsof -i :5432
kill -9 <PID>

# Then restart Docker
docker-compose up -d
```

**Problem:** Database not persisting data
```bash
# Check volumes
docker volume ls

# Recreate
docker-compose down
docker-compose up -d
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Can't Push - Branch Doesn't Exist Remotely

```bash
# Error: fatal: The current branch has no upstream branch

# Solution: Set upstream
git push -u origin feature/devX-module-name
```

### Issue 2: Can't Push - Remote Has Changes

```bash
# Error: Updates were rejected because the remote contains work

# Solution: Pull first, then push
git pull origin feature/devX-module-name
# Resolve any conflicts
git push
```

### Issue 3: Forgot Which Branch You're On

```bash
# Check current branch
git branch

# Current branch has * next to it
```

### Issue 4: Working on Wrong Branch

```bash
# Save your work
git stash

# Switch to correct branch
git checkout feature/dev1-auth-user

# Restore your work
git stash pop
```

### Issue 5: Need to Undo Last Commit

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Undo commit and discard changes (DANGEROUS!)
git reset --hard HEAD~1
```

### Issue 6: Accidentally Committed to Develop

```bash
# Undo the commit
git reset --soft HEAD~1

# Switch to your branch
git checkout feature/devX-module-name

# Commit again
git add .
git commit -m "feat: your message"
git push
```

---

## ✅ Daily Checklist

### Every Morning

- [ ] `docker-compose up -d` (start database)
- [ ] `git checkout feature/devX-module-name`
- [ ] `git pull origin develop`
- [ ] `npm install`
- [ ] `npm run start:dev`
- [ ] Start coding

### Throughout the Day

- [ ] `git status` (check changes)
- [ ] `git add src/modules/your-module/`
- [ ] `git commit -m "feat: description"`
- [ ] `git push`

### Before Leaving

- [ ] Push all your commits
- [ ] Check GitHub/GitLab to verify
- [ ] Update team on progress (optional)

---

## 📞 When to Ask for Help

### Ask Project Manager:

- Can't resolve merge conflicts
- Accidentally pushed to wrong branch
- Need to undo something major
- Git seems "broken"

### Ask Teammates:

- What branch should I use?
- Did you push your changes?
- Can you review my code?

---

## 🎓 Learning Resources

- **Git Basics:** https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control
- **GitHub Guides:** https://guides.github.com/
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf
- **Interactive Tutorial:** https://learngitbranching.js.org/

---

## 🆘 Emergency: "I Messed Up!"

### Stay Calm!

Most Git mistakes can be fixed. Here's what to do:

1. **Don't panic!** Git rarely loses your work
2. **Stop what you're doing**
3. **Take a screenshot** of the error
4. **Contact the Project Manager**
5. **Don't force push** unless instructed

### Quick Fixes

```bash
# See what happened recently
git reflog

# Undo last operation
git reset HEAD~1

# Discard all local changes (CAREFUL!)
git reset --hard HEAD

# Get clean copy of file from remote
git checkout origin/develop -- path/to/file.ts
```

---

## 📝 Quick Reference Card

```bash
# DOCKER COMMANDS (Run First!)
docker-compose up -d    # Start database
docker ps               # Check running
docker-compose stop     # Stop services

# DAILY COMMANDS - Learn these!
git status              # What changed?
git pull origin develop # Get team changes
git add .               # Stage all changes
git commit -m "msg"     # Save changes
git push                # Upload changes

# BRANCH COMMANDS
git branch              # List branches
git checkout branch     # Switch branch
git checkout -b new     # Create & switch

# UNDO COMMANDS
git stash               # Save work temporarily
git stash pop           # Restore saved work
git reset HEAD file     # Unstage file

# INFO COMMANDS
git log --oneline       # View history
git diff                # View changes
git branch -a           # All branches
```

---

## 🎯 Remember

1. **Start Docker first** - Always run `docker-compose up -d` before working
2. **Commit often** - Small, frequent commits are better
3. **Write good messages** - Help your future self
4. **Pull before push** - Stay in sync with team
5. **Never push to main** - Use your feature branch
6. **Ask for help** - Don't struggle alone!

---

**Happy Coding! 🚀**

*For detailed Git workflow and conflict resolution, see `GIT_WORKFLOW.md`*

