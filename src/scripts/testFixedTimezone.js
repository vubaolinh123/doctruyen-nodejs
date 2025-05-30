// Test timezone fix
console.log('=== TESTING FIXED TIMEZONE ===');
console.log('');

// Set timezone như trong server
process.env.TZ = 'Asia/Ho_Chi_Minh';

const moment = require('moment-timezone');
const { getLogTimestamp, getVietnamTimestamp } = require('../utils/timezone');

console.log('1. Current system time:');
console.log('   new Date():', new Date().toString());
console.log('   new Date().toLocaleString():', new Date().toLocaleString());
console.log('');

console.log('2. Moment tests:');
console.log('   moment():', moment().format('YYYY-MM-DD HH:mm:ss Z'));
console.log('   moment().tz("Asia/Ho_Chi_Minh"):', moment().tz("Asia/Ho_Chi_Minh").format('YYYY-MM-DD HH:mm:ss Z'));
console.log('   moment.tz("Asia/Ho_Chi_Minh"):', moment.tz("Asia/Ho_Chi_Minh").format('YYYY-MM-DD HH:mm:ss Z'));
console.log('');

console.log('3. Fixed utils functions:');
console.log('   getLogTimestamp():', getLogTimestamp());
console.log('   getVietnamTimestamp():', getVietnamTimestamp());
console.log('   getVietnamTimestamp("YYYY-MM-DD HH:mm:ss Z"):', getVietnamTimestamp("YYYY-MM-DD HH:mm:ss Z"));
console.log('');

console.log('4. Time comparison:');
const jsTime = new Date();
const utilsTime = getLogTimestamp();
const jsHour = jsTime.getHours();
const utilsHour = parseInt(utilsTime.split(' ')[1].split(':')[0]);

console.log('   JS time hour:', jsHour);
console.log('   Utils time hour:', utilsHour);
console.log('   Difference:', Math.abs(jsHour - utilsHour), 'hours');

if (Math.abs(jsHour - utilsHour) === 0) {
  console.log('   ✅ FIXED! Times match correctly');
} else {
  console.log('   ❌ Still broken - time difference detected');
}

console.log('');
console.log('5. Simulated log output:');
const timestamp = getLogTimestamp();
console.log(`[${timestamp}] [GET] [/api/test] ✅ [200] [45ms]`);

console.log('');
console.log('=== TEST COMPLETE ===');
