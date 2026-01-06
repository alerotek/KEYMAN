#!/bin/bash

# Keyman Hotel Production Verification Script
# This script runs comprehensive verification of the production system

echo "🏨 Keyman Hotel Production Verification"
echo "====================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local file not found. Creating template..."
    cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF
    echo "📝 Please update .env.local with your Supabase credentials"
    echo "   Then run: ./verify-production.sh"
    exit 1
fi

# Load environment variables
export $(cat .env.local | xargs)

# Check if required variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
fi

echo "🔗 Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "📅 Verification started: $(date)"
echo ""

# Run the verification script
node scripts/production-verification.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 VERIFICATION SUCCESSFUL!"
    echo "✅ System is ready for production deployment"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Deploy to Vercel: vercel --prod"
    echo "2. Monitor deployment: https://vercel.com/alerotek/KEYMAN"
    echo "3. Test production: https://keyman-hotel.vercel.app"
else
    echo ""
    echo "❌ VERIFICATION FAILED!"
    echo "⚠️  Please fix critical issues before production deployment"
    echo ""
    echo "📋 Troubleshooting:"
    echo "1. Check .env.local configuration"
    echo "2. Verify Supabase connection"
    echo "3. Run database migrations"
    echo "4. Review error messages above"
fi

echo ""
echo "🏁 Verification completed: $(date)"
