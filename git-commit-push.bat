@echo off
REM Script to track changes, commit, and push to Git repository
REM Asks for commit message and branch selections

setlocal enabledelayedexpansion

echo ========================================
echo Git Commit and Push Script
echo ========================================
echo.

REM Check if Git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Git is not installed or not in PATH.
    echo Please install Git first using setup-git-and-clone.bat
    pause
    exit /b 1
)

REM Check if we're in a Git repository
git rev-parse --git-dir >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Not a Git repository. Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Get current branch and remote URL dynamically
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%i
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%i

echo.
echo ========================================
echo Current Git Status
echo ========================================
echo.
echo Current branch : !CURRENT_BRANCH!
echo Remote origin  : !REMOTE_URL!
echo.

REM Show current status
git status

echo.
echo ========================================
echo Select Branch
echo ========================================
echo.

REM Get list of branches
echo Available branches:
echo.
for /f "tokens=*" %%i in ('git branch -a') do (
    echo %%i
)

echo.
set /p GIT_BRANCH="Enter branch name to push to [press Enter to use '!CURRENT_BRANCH!']: "

REM Default to current branch if nothing entered
if "!GIT_BRANCH!"=="" set GIT_BRANCH=!CURRENT_BRANCH!

REM Only switch branches if different from current
if /i "!GIT_BRANCH!" neq "!CURRENT_BRANCH!" (
    REM Verify branch exists or create it
    git rev-parse --verify !GIT_BRANCH! >nul 2>nul
    if !errorlevel! neq 0 (
        echo.
        echo Branch '!GIT_BRANCH!' does not exist locally.
        set /p CREATE_BRANCH="Create new branch '!GIT_BRANCH!'? (y/n): "

        if /i "!CREATE_BRANCH!"=="y" (
            echo Creating branch '!GIT_BRANCH!'...
            git checkout -b !GIT_BRANCH!
            if !errorlevel! neq 0 (
                echo Failed to create branch.
                pause
                exit /b 1
            )
            echo Branch '!GIT_BRANCH!' created successfully.
        ) else (
            echo Operation cancelled.
            pause
            exit /b 1
        )
    ) else (
        echo Switching to branch '!GIT_BRANCH!'...
        git checkout !GIT_BRANCH!
        if !errorlevel! neq 0 (
            echo Failed to switch to branch. You may have uncommitted changes.
            pause
            exit /b 1
        )
        echo Successfully switched to branch '!GIT_BRANCH!'.
    )
) else (
    echo Using current branch '!GIT_BRANCH!'.
)

echo.
echo ========================================
echo Sync with Remote
echo ========================================
echo.
set /p DO_PULL="Pull latest changes from remote before pushing? (y/n) [recommended: y]: "

if /i "!DO_PULL!"=="y" (
    echo Pulling latest changes...
    git pull --rebase origin !GIT_BRANCH!
    if !errorlevel! neq 0 (
        echo.
        echo Warning: Pull/rebase failed. There may be conflicts to resolve.
        echo Resolve conflicts, then re-run this script.
        pause
        exit /b 1
    )
    echo Pull successful.
)

echo.
echo ========================================
echo Enter Commit Message
echo ========================================
echo.
echo Examples:
echo   - "feat: add order management features"
echo   - "fix: resolve kitchen display bug"
echo   - "docs: update README with setup instructions"
echo   - "refactor: reorganize menu components"
echo.

set /p COMMIT_MESSAGE="Enter commit message: "

if "!COMMIT_MESSAGE!"=="" (
    echo Error: Commit message cannot be empty.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Summary
echo ========================================
echo Branch  : !GIT_BRANCH!
echo Message : !COMMIT_MESSAGE!
echo Remote  : !REMOTE_URL!
echo.

set /p CONFIRM="Proceed with commit and push? (y/n): "

if /i "!CONFIRM!"=="y" (
    echo.
    echo ========================================
    echo Processing...
    echo ========================================
    echo.
    
    REM Stage all changes
    echo Staging all changes...
    git add .
    if !errorlevel! neq 0 (
        echo Error: Failed to stage changes.
        pause
        exit /b 1
    )

    REM Check if there is anything to commit
    git diff --cached --quiet
    if !errorlevel! equ 0 (
        echo.
        echo Nothing to commit. Working tree is clean.
        echo No new commit was created.
        echo.
    ) else (
        REM Commit changes
        echo Committing changes...
        git commit -m "!COMMIT_MESSAGE!"
        if !errorlevel! neq 0 (
            echo Error: Failed to commit changes.
            pause
            exit /b 1
        )
    )

    REM Push changes
    echo Pushing to branch '!GIT_BRANCH!'...
    git push -u origin !GIT_BRANCH!
    if !errorlevel! neq 0 (
        echo Error: Failed to push changes.
        echo.
        echo Please check:
        echo - Your internet connection
        echo - Your GitHub credentials
        echo - The remote repository exists
        echo.
        echo Try pushing manually:
        echo   git push -u origin !GIT_BRANCH!
        pause
        exit /b 1
    )
    
    echo.
    echo ========================================
    echo Success!
    echo ========================================
    echo.
    echo Changes have been committed and pushed to:
    echo Repository : !REMOTE_URL!
    echo Branch     : !GIT_BRANCH!
    echo Message    : !COMMIT_MESSAGE!
    echo.
    echo Recent commits:
    git log --oneline -5
    echo.
    echo You can now create a Pull Request on GitHub if needed.
    echo.
    
) else (
    echo Operation cancelled.
)

echo.
pause
