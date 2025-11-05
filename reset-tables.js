/**
 * Database Reset Script
 * 
 * This script clears all game tables and invitations from the database.
 * Use this to clean up old/stale tables that might be causing issues.
 * 
 * Usage: node reset-tables.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function resetTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // Get count before deletion
        const beforeTables = await client.query('SELECT COUNT(*) FROM game_tables');
        const beforeInvites = await client.query('SELECT COUNT(*) FROM invitations');
        
        console.log(`\n📊 Current state:`);
        console.log(`   Tables: ${beforeTables.rows[0].count}`);
        console.log(`   Invitations: ${beforeInvites.rows[0].count}`);
        
        // Delete all game tables
        console.log('\n🗑️  Deleting all game tables...');
        const tableResult = await client.query('DELETE FROM game_tables RETURNING *');
        console.log(`✅ Deleted ${tableResult.rowCount} game tables`);
        
        // Delete all invitations
        console.log('🗑️  Deleting all invitations...');
        const inviteResult = await client.query('DELETE FROM invitations RETURNING *');
        console.log(`✅ Deleted ${inviteResult.rowCount} invitations`);
        
        // Reset sequences (optional - ensures clean IDs)
        // Note: If tables use UUID/string IDs, sequences may not exist
        console.log('\n🔄 Checking for ID sequences...');
        try {
            await client.query('ALTER SEQUENCE game_tables_id_seq RESTART WITH 1');
            console.log('✅ Game tables sequence reset');
        } catch (err) {
            console.log('ℹ️  Game tables sequence not found (tables may use UUID/string IDs)');
        }
        
        try {
            await client.query('ALTER SEQUENCE invitations_id_seq RESTART WITH 1');
            console.log('✅ Invitations sequence reset');
        } catch (err) {
            console.log('ℹ️  Invitations sequence not found (tables may use UUID/string IDs)');
        }
        
        // Verify deletion
        const afterTables = await client.query('SELECT COUNT(*) FROM game_tables');
        const afterInvites = await client.query('SELECT COUNT(*) FROM invitations');
        
        console.log(`\n📊 Final state:`);
        console.log(`   Tables: ${afterTables.rows[0].count}`);
        console.log(`   Invitations: ${afterInvites.rows[0].count}`);
        
        console.log('\n✅ Database reset complete!');
        console.log('📝 Note: In-memory tables on the server will remain until server restart or natural cleanup.');
        
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the reset
resetTables()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    });

