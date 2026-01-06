@echo off
REM Keyman Hotel Production Verification Script for Windows
REM This script runs comprehensive verification of the production system

echo 🏨 Keyman Hotel Production Verification
echo =====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ⚠️  .env.local file not found. Creating template...
    (
        echo NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
        echo SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    ) > .env.local
    echo 📝 Please update .env.local with your Supabase credentials
    echo    Then run: verify-production.bat
    pause
    exit /b 1
)

echo 🔗 Supabase URL configured in .env.local
echo 📅 Verification started: %date% %time%
echo.

REM Run the verification script
node scripts/production-verification.js

REM Check exit code
if %errorlevel% equ 0 (
    echo.
    echo 🎉 VERIFICATION SUCCESSFUL!
    echo ✅ System is ready for production deployment
    echo.
    echo 📋 Next Steps:
    echo 1. Deploy to Vercel: vercel --prod
    echo 2. Monitor deployment: https://vercel.com/alerotek/KEYMAN
    echo 3. Test production: https://keyman-hotel.vercel.app
) else (
    echo.
    echo ❌ VERIFICATION FAILED!
    echo ⚠️  Please fix critical issues before production deployment
    echo.
    echo 📋 Troubleshooting:
    echo 1. Check .env.local configuration
    echo 2. Verify Supabase connection
    echo 3. Run database migrations
    echo 4. Review error messages above
)

echo.
echo 🏁 Verification completed: %date% %time%
pause
