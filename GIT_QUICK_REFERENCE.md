# Git Quick Reference for Team

## 🎯 Your Module Assignments

### Developer 1 (Auth & Users)
```
Modules:
✓ src/modules/auth/
✓ src/modules/users/
✓ src/modules/admin/
✓ src/modules/notifications/
✓ src/common/guards/
✓ src/common/decorators/

Branch: feature/dev1-auth-user
```

### Developer 2 (Game & WebSocket)
```
Modules:
✓ src/modules/game/
✓ src/modules/tables/
✓ src/modules/websocket/
✓ src/modules/leaderboard/

Branch: feature/dev2-game-websocket
```

### Developer 3 (Blockchain & Wallet)
```
Modules:
✓ src/modules/blockchain/
✓ src/modules/wallet/
✓ src/modules/transactions/
✓ src/modules/nft/
✓ src/contracts/

Branch: feature/dev3-blockchain-wallet
```

---

## 📋 Daily Workflow (5 Steps)

```bash
# 1. Make sure you're on your branch
git checkout feature/devX-your-module

# 2. Pull latest from develop
git pull origin develop
npm install

# 3. Make your changes
# (work on YOUR modules only)

# 4. Commit YOUR changes
git add src/modules/your-module/
git commit -m "feat(module): What you did"

# 5. Push to YOUR branch
git push origin feature/devX-your-module
```

---

## 🔄 Weekly Sync (Monday & Thursday)

```bash
# Get team's latest changes
git checkout feature/devX-your-module
git pull origin develop
npm install

# Fix any conflicts (see below)

# Push updated branch
git push origin feature/devX-your-module

# Test everything works
npm run start:dev
```

---

## ⚠️ Fixing Merge Conflicts

### Conflict in package.json

```bash
# 1. Open package.json and merge both dependency lists
code package.json

# 2. Remove conflict markers (<<<<<<, ======, >>>>>>)

# 3. Delete package-lock.json
rm package-lock.json

# 4. Reinstall
npm install

# 5. Commit
git add package.json package-lock.json
git commit -m "Merge: Resolved dependencies"
git push
```

### Conflict in Code Files

```bash
# 1. Open the conflicted file
code src/path/to/file.ts

# 2. Look for conflict markers:
<<<<<<< HEAD
Your code
=======
Their code
>>>>>>> feature/other-branch

# 3. Keep what's needed (usually both)
# Remove markers

# 4. Test it works
npm run start:dev

# 5. Commit
git add src/path/to/file.ts
git commit -m "Merge: Resolved code conflict"
git push
```

---

## 🚫 NEVER Commit These

```
❌ node_modules/
❌ .env
❌ dist/
❌ *.log
❌ .vscode/
```

---

## ✅ ALWAYS Commit These

```
✅ package.json
✅ package-lock.json
✅ Your module code
✅ Tests for your modules
✅ .env.example (if you add vars)
```

---

## 🆘 Common Commands

```bash
# Where am I?
git branch                    # Shows current branch

# What did I change?
git status                    # Shows modified files
git diff                      # Shows exact changes

# Undo my last changes
git checkout -- filename      # Discard changes to file

# Start over (CAREFUL!)
git reset --hard origin/develop   # Reset to develop

# Save work for later
git stash                     # Save current work
git stash pop                 # Restore saved work

# Check if I'm up to date
git fetch origin
git status                    # Shows if behind/ahead
```

---

## 📝 Good Commit Messages

```bash
# Format: type(scope): description

✅ GOOD:
git commit -m "feat(auth): Implement JWT login"
git commit -m "fix(game): Resolve turn order bug"
git commit -m "docs(readme): Add setup instructions"

❌ BAD:
git commit -m "updates"
git commit -m "fixed stuff"
git commit -m "asdfsdf"
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code improvement
- `test` - Tests
- `chore` - Maintenance

---

## 🎯 Before Creating Pull Request

```bash
# Checklist:
□ git pull origin develop        # Up to date?
□ npm install                    # Dependencies synced?
□ npm run lint                   # No errors?
□ npm run build                  # Builds successfully?
□ npm run start:dev              # Starts OK?
□ Test your features             # Everything works?

# Then create PR on GitHub/GitLab
```

---

## 🔥 Emergency Commands

```bash
# I committed to wrong branch!
git reset --soft HEAD~1          # Undo commit, keep changes
git stash                        # Save changes
git checkout correct-branch      # Switch branch
git stash pop                    # Restore changes

# I need to undo everything!
git reset --hard origin/develop  # ⚠️ LOSES ALL CHANGES
git clean -fd                    # Clean untracked files

# I accidentally deleted my branch!
git reflog                       # Find commit hash
git checkout -b branch-name hash # Recreate branch
```

---

## 🤝 Communication

### Before doing these, ask team:
- Modifying `app.module.ts`
- Changing database entities
- Adding global dependencies
- Modifying shared config files
- Changing API interfaces

### Message team when:
- Creating Pull Request
- Merging to develop
- Breaking changes
- Need help with conflicts
- Stuck on integration

---

## 📞 Need Help?

| Issue | Action |
|-------|--------|
| Merge conflict | Check GIT_WORKFLOW.md Section: "Handling Merge Conflicts" |
| Can't push | `git pull origin develop` first |
| Lost changes | `git reflog` to find |
| Wrong branch | `git stash`, switch, `git stash pop` |
| Broken build | `npm install && npm run build` |
| Still stuck | Ask Project Manager or team! |

---

## 📅 Weekly Schedule

**Monday:**
- 9:00 AM - Team standup
- Pull latest develop
- Sync dependencies
- Resolve conflicts

**Tuesday-Thursday:**
- Daily commits
- Daily push to your branch
- Code review (optional)

**Friday:**
- Create/update Pull Request
- Team integration testing
- Plan next week

---

## 💾 Save This Workflow

```bash
# Your daily routine:

1. Start work:
   git checkout feature/devX-module
   git pull origin develop
   npm install
   npm run start:dev

2. During work:
   # Make changes to YOUR modules only
   git status                   # Check what changed
   
3. End of day:
   git add src/modules/your-module/
   git commit -m "feat(module): What you accomplished"
   git push origin feature/devX-module

4. Weekly sync:
   git pull origin develop      # Monday & Thursday
   npm install
   # Fix conflicts if any
   npm run start:dev           # Test
   git push origin feature/devX-module
```

---

## 🎓 Learn More

- Full Guide: `GIT_WORKFLOW.md`
- Git Basics: https://git-scm.com/docs
- GitHub Help: https://docs.github.com
- Ask your team! 🤝

---

## ✅ Remember

1. **Commit often** - Small commits are easier to manage
2. **Pull regularly** - Stay synced with team
3. **Test always** - Before committing and after pulling
4. **Communicate** - When in doubt, ask!
5. **Only YOUR modules** - Don't modify others' code without asking

---

**Print this page and keep it handy! 📌**

**You got this! 🚀**

