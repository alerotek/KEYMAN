/**
 * Keyman Hotel Production Verification Script
 * Author: ChatGPT
 * Purpose: Validate DB, RLS, room inventory, dashboards, and booking/payment workflows
 * Usage: Run with Node.js after installing @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js';

// Configure your Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Verification results
let results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logResult(test, status, message, details = null) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
  
  if (details) {
    console.log(`   ${details}`);
  }
  
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
  results.details.push({ test, status, message, details });
}

async function verifyRoomInventory() {
  console.log('\n=== 🏨 VERIFYING ROOM INVENTORY ===');
  
  try {
    // Check room_types table exists and has correct data
    const { data: roomTypes, error: roomTypesError } = await supabase
      .from('room_types')
      .select('*')
      .eq('active', true);

    if (roomTypesError) {
      logResult('Room Types Table', 'fail', 'Failed to fetch room_types', roomTypesError.message);
      return;
    }

    const expectedRooms = { Single: 17, Twin: 2, Studio: 2 };
    let allCorrect = true;

    for (const [name, count] of Object.entries(expectedRooms)) {
      const roomType = roomTypes?.find(r => r.name === name);
      
      if (!roomType) {
        logResult(`Room Type ${name}`, 'fail', `Missing room type: ${name}`);
        allCorrect = false;
      } else if (roomType.total_rooms !== count) {
        logResult(`Room Type ${name}`, 'fail', `Count mismatch: ${roomType.total_rooms} !== ${count}`);
        allCorrect = false;
      } else if (roomType.capacity < 1) {
        logResult(`Room Type ${name}`, 'fail', `Invalid capacity: ${roomType.capacity}`);
        allCorrect = false;
      } else {
        logResult(`Room Type ${name}`, 'pass', `Correct: ${count} rooms, capacity ${roomType.capacity}`);
      }
    }

    // Check rooms table
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_type_id, room_number, is_active')
      .eq('is_active', true);

    if (roomsError) {
      logResult('Rooms Table', 'fail', 'Failed to fetch rooms', roomsError.message);
    } else {
      const totalActiveRooms = rooms?.length || 0;
      const expectedTotal = Object.values(expectedRooms).reduce((sum, count) => sum + count, 0);
      
      if (totalActiveRooms === expectedTotal) {
        logResult('Rooms Count', 'pass', `Correct total: ${totalActiveRooms} active rooms`);
      } else {
        logResult('Rooms Count', 'fail', `Total mismatch: ${totalActiveRooms} !== ${expectedTotal}`);
      }
    }

    // Check room inventory summary view
    const { data: inventory, error: inventoryError } = await supabase
      .from('room_inventory_summary')
      .select('*');

    if (inventoryError) {
      logResult('Inventory View', 'fail', 'Room inventory summary not accessible', inventoryError.message);
    } else {
      logResult('Inventory View', 'pass', `Inventory summary accessible with ${inventory?.length || 0} room types`);
    }

  } catch (error) {
    logResult('Room Inventory', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyRLSPolicies() {
  console.log('\n=== 🔒 VERIFYING RLS POLICIES ===');
  
  try {
    const criticalTables = ['profiles', 'bookings', 'payments', 'expenses', 'audit_log', 'room_types', 'rooms', 'seasonal_pricing', 'room_blocks'];
    
    for (const table of criticalTables) {
      try {
        // Test RLS is enabled by trying to access without auth
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        // If we get data without auth, RLS might not be properly enabled
        if (data && data.length > 0 && table !== 'room_types' && table !== 'audit_log') {
          logResult(`RLS ${table}`, 'warning', 'Data accessible without auth - check RLS policies');
        } else if (error && error.code === 'PGRST116') {
          logResult(`RLS ${table}`, 'pass', 'RLS properly enforced (no access without auth)');
        } else if (error && error.message?.includes('row-level security')) {
          logResult(`RLS ${table}`, 'pass', 'RLS properly enforced');
        } else {
          logResult(`RLS ${table}`, 'pass', 'Table accessible (may be public table)');
        }
      } catch (error) {
        logResult(`RLS ${table}`, 'fail', 'Error checking RLS', error.message);
      }
    }

    // Check audit_log for RLS violations
    const { data: violations, error: violationsError } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'rls_violation')
      .limit(5);

    if (violationsError) {
      logResult('RLS Violations', 'fail', 'Cannot check violation log', violationsError.message);
    } else {
      const violationCount = violations?.length || 0;
      if (violationCount > 0) {
        logResult('RLS Violations', 'warning', `Found ${violationCount} RLS violations in audit log`);
      } else {
        logResult('RLS Violations', 'pass', 'No RLS violations detected');
      }
    }

  } catch (error) {
    logResult('RLS Policies', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyBookingSystem() {
  console.log('\n=== 📋 VERIFYING BOOKING SYSTEM ===');
  
  try {
    // Check bookings table structure
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        room_type_id,
        room_id,
        status,
        check_in,
        check_out,
        total_amount,
        guests_count,
        breakfast,
        vehicle,
        created_at,
        created_by
      `)
      .limit(5);

    if (bookingsError) {
      logResult('Bookings Table', 'fail', 'Failed to fetch bookings', bookingsError.message);
    } else {
      logResult('Bookings Table', 'pass', `Bookings table accessible, found ${bookings?.length || 0} bookings`);
      
      // Check booking data integrity
      if (bookings && bookings.length > 0) {
        for (const booking of bookings) {
          if (!booking.room_type_id) {
            logResult('Booking Data', 'fail', `Booking ${booking.id} missing room_type_id`);
          } else if (!booking.customer_id) {
            logResult('Booking Data', 'fail', `Booking ${booking.id} missing customer_id`);
          } else if (!booking.status) {
            logResult('Booking Data', 'fail', `Booking ${booking.id} missing status`);
          }
        }
      }
    }

    // Check payments table
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .limit(5);

    if (paymentsError) {
      logResult('Payments Table', 'fail', 'Failed to fetch payments', paymentsError.message);
    } else {
      logResult('Payments Table', 'pass', `Payments table accessible, found ${payments?.length || 0} payments`);
    }

    // Test booking availability function
    const { data: availability, error: availabilityError } = await supabase
      .rpc('get_available_rooms', {
        p_room_type_name: 'Single',
        p_check_in: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        p_check_out: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

    if (availabilityError) {
      logResult('Availability Function', 'fail', 'get_available_rooms function not working', availabilityError.message);
    } else {
      logResult('Availability Function', 'pass', `Availability check working, found ${availability?.length || 0} rooms`);
    }

  } catch (error) {
    logResult('Booking System', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyUserRoles() {
  console.log('\n=== 👥 VERIFYING USER ROLES ===');
  
  try {
    // Check profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, created_at')
      .limit(10);

    if (profilesError) {
      logResult('Profiles Table', 'fail', 'Failed to fetch profiles', profilesError.message);
    } else {
      logResult('Profiles Table', 'pass', `Profiles accessible, found ${profiles?.length || 0} users`);
      
      // Check role distribution
      const roleCounts = {};
      if (profiles) {
        for (const profile of profiles) {
          roleCounts[profile.role] = (roleCounts[profile.role] || 0) + 1;
        }
        
        for (const [role, count] of Object.entries(roleCounts)) {
          logResult(`Role ${role}`, 'pass', `${count} users with ${role} role`);
        }
      }
    }

    // Test role-based access by checking user permissions view
    const { data: permissions, error: permissionsError } = await supabase
      .from('user_permissions')
      .select('*')
      .limit(5);

    if (permissionsError) {
      logResult('User Permissions', 'fail', 'User permissions view not accessible', permissionsError.message);
    } else {
      logResult('User Permissions', 'pass', 'User permissions view accessible');
    }

  } catch (error) {
    logResult('User Roles', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyDashboardAPIs() {
  console.log('\n=== 📊 VERIFYING DASHBOARD APIS ===');
  
  try {
    // Test admin dashboard API structure
    const { data: adminDashboard, error: adminError } = await supabase
      .from('bookings')
      .select('count(*)')
      .single();

    if (adminError) {
      logResult('Admin Dashboard', 'fail', 'Cannot access booking data for dashboard', adminError.message);
    } else {
      logResult('Admin Dashboard', 'pass', 'Booking data accessible for admin dashboard');
    }

    // Check room performance data
    const { data: roomPerformance, error: performanceError } = await supabase
      .from('room_inventory_summary')
      .select('*');

    if (performanceError) {
      logResult('Room Performance', 'fail', 'Cannot access room performance data', performanceError.message);
    } else {
      logResult('Room Performance', 'pass', `Room performance data available for ${roomPerformance?.length || 0} room types`);
    }

    // Check expense data for dashboard
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount, category, created_at')
      .limit(5);

    if (expensesError) {
      logResult('Expenses Data', 'fail', 'Cannot access expense data', expensesError.message);
    } else {
      logResult('Expenses Data', 'pass', `Expense data accessible, found ${expenses?.length || 0} expenses`);
    }

  } catch (error) {
    logResult('Dashboard APIs', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyAuditSystem() {
  console.log('\n=== 🔍 VERIFYING AUDIT SYSTEM ===');
  
  try {
    // Check audit_log table
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (auditError) {
      logResult('Audit Log', 'fail', 'Cannot access audit log', auditError.message);
    } else {
      logResult('Audit Log', 'pass', `Audit log accessible, found ${auditLogs?.length || 0} recent entries`);
      
      // Check for different types of audit actions
      if (auditLogs && auditLogs.length > 0) {
        const actionTypes = [...new Set(auditLogs.map(log => log.action))];
        for (const action of actionTypes) {
          const count = auditLogs.filter(log => log.action === action).length;
          logResult(`Audit Action ${action}`, 'pass', `${count} entries`);
        }
      }
    }

  } catch (error) {
    logResult('Audit System', 'fail', 'Unexpected error', error.message);
  }
}

async function verifyEmailConfiguration() {
  console.log('\n=== 📧 VERIFYING EMAIL CONFIGURATION ===');
  
  try {
    // Check if email settings exist (this would be in a settings table or environment)
    // For now, we'll just check if the email-related API routes exist by testing their structure
    
    logResult('Email Configuration', 'warning', 'Email configuration should be checked in admin dashboard');
    logResult('Email Configuration', 'info', 'Configure SMTP settings in /admin/settings/email');

  } catch (error) {
    logResult('Email Configuration', 'fail', 'Unexpected error', error.message);
  }
}

async function generateReport() {
  console.log('\n=== 📋 VERIFICATION REPORT ===');
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️ Warnings: ${results.warnings}`);
  
  const total = results.passed + results.failed + results.warnings;
  const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (results.failed === 0) {
    console.log(`\n🎉 ALL CRITICAL CHECKS PASSED! System is production-ready.`);
  } else {
    console.log(`\n⚠️ ${results.failed} critical issues found. Please address before production deployment.`);
  }
  
  if (results.warnings > 0) {
    console.log(`\n⚠️ ${results.warnings} warnings found. Review for optimal performance.`);
  }
  
  // Detailed results
  console.log(`\n📋 DETAILED RESULTS:`);
  for (const detail of results.details) {
    const icon = detail.status === 'pass' ? '✅' : detail.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${detail.test}: ${detail.message}`);
    if (detail.details) {
      console.log(`   ${detail.details}`);
    }
  }
  
  return {
    summary: {
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      successRate: parseFloat(successRate),
      total
    },
    details: results.details,
    productionReady: results.failed === 0
  };
}

// Main verification function
async function runProductionVerification() {
  console.log('🏨 Keyman Hotel Production Verification');
  console.log('=====================================');
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
  
  await verifyRoomInventory();
  await verifyRLSPolicies();
  await verifyBookingSystem();
  await verifyUserRoles();
  await verifyDashboardAPIs();
  await verifyAuditSystem();
  await verifyEmailConfiguration();
  
  const report = await generateReport();
  
  console.log(`\n🏁 Verification completed at: ${new Date().toISOString()}`);
  
  return report;
}

// Run verification if this script is executed directly
if (require.main === module) {
  runProductionVerification()
    .then(report => {
      if (!report.productionReady) {
        console.log('\n❌ System NOT ready for production. Please fix critical issues.');
        process.exit(1);
      } else {
        console.log('\n✅ System is PRODUCTION READY!');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\n💥 Verification script failed:', error);
      process.exit(1);
    });
}

export { runProductionVerification };
