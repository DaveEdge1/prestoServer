#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration for all Presto applications
const APPLICATIONS = [
    { name: 'Download Server', dir: 'downloads', script: 'downloadServer.js', logPrefix: 'download_server' },
    { name: 'JSON Editor Server', dir: 'jsonEditor', script: 'editorServer.js', logPrefix: 'json_editor_server' },
    { name: 'SPARQL Server', dir: 'graphDB', script: 'sparqlServer.js', logPrefix: 'sparql_server' },
    { name: 'Query Database Server', dir: 'query', script: 'queryDB.js', logPrefix: 'query_db_server' },
    { name: 'Query Server', dir: 'query', script: 'queryServer.js', logPrefix: 'query_server' },
    { name: 'Main Presto Server', dir: 'presto', script: 'prestoServer.js', logPrefix: 'main_presto_server' },
    { name: 'Visualization Server', dir: 'viz', script: 'viz.js', logPrefix: 'viz_server' },
    { name: 'Form Server', dir: 'prestoForm', script: 'formServer.js', logPrefix: 'form_server' },
    { name: 'R Server', dir: 'getLipds', script: 'Rserver.js', logPrefix: 'r_server' }
];

class PrestoManager {
    constructor() {
        this.processes = new Map();
        this.logsDir = path.join(__dirname, 'logs');
        this.individualLogsDir = path.join(this.logsDir, 'individual');
        this.combinedErrorLog = path.join(this.logsDir, 'combined_stderr.log');
        this.setupLogging();
    }

    setupLogging() {
        // Create log directories
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        if (!fs.existsSync(this.individualLogsDir)) {
            fs.mkdirSync(this.individualLogsDir, { recursive: true });
        }

        // Initialize combined error log
        const timestamp = new Date().toISOString();
        const header = `=== Presto Server Suite Combined Stderr Log ===\nStarted at: ${timestamp}\n=============================================\n\n`;
        fs.writeFileSync(this.combinedErrorLog, header);
    }

    log(message, color = 'white') {
        const colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async startApplication(app) {
        return new Promise((resolve, reject) => {
            const appPath = path.join(__dirname, app.dir);
            const scriptPath = path.join(appPath, app.script);
            
            this.log(`\nStarting ${app.name}...`, 'yellow');
            this.log(`  Directory: ${appPath}`, 'blue');
            this.log(`  Script: ${app.script}`, 'blue');

            // Check if script exists
            if (!fs.existsSync(scriptPath)) {
                const error = `Script not found: ${scriptPath}`;
                this.log(`  ✗ ${error}`, 'red');
                return reject(new Error(error));
            }

            // Set up log files
            const stdoutLog = path.join(this.individualLogsDir, `${app.logPrefix}.log`);
            const stderrLog = path.join(this.individualLogsDir, `${app.logPrefix}_error.log`);

            // Initialize individual log files
            const logHeader = `=== ${app.name} Log ===\nStarted at: ${new Date().toISOString()}\nDirectory: ${appPath}\nApplication: ${app.script}\n=========================\n\n`;
            const errorHeader = `=== ${app.name} Error Log ===\nStarted at: ${new Date().toISOString()}\nDirectory: ${appPath}\nApplication: ${app.script}\n==============================\n\n`;
            
            fs.writeFileSync(stdoutLog, logHeader);
            fs.writeFileSync(stderrLog, errorHeader);

            // Start the Node.js process
            const child = spawn('node', [app.script], {
                cwd: appPath,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true // Detach so process continues after parent exits
            });

            // Unref the child so parent can exit independently
            child.unref();

            // Set up logging
            const stdoutStream = fs.createWriteStream(stdoutLog, { flags: 'a' });
            const stderrStream = fs.createWriteStream(stderrLog, { flags: 'a' });
            const combinedStream = fs.createWriteStream(this.combinedErrorLog, { flags: 'a' });

            // Pipe output to log files (stdout is ignored, only stderr)
            child.stderr.pipe(stderrStream);
            
            // Also pipe stderr to combined log with app identification
            combinedStream.write(`--- ${app.name} (${new Date().toISOString()}) ---\n`);
            child.stderr.pipe(combinedStream, { end: false });

            let hasExited = false;
            let processInfo = null;

            // Handle process events
            child.on('spawn', () => {
                this.log(`  Process spawned with PID: ${child.pid}`, 'blue');
                
                processInfo = {
                    name: app.name,
                    process: child,
                    pid: child.pid,
                    startTime: new Date(),
                    stdoutLog,
                    stderrLog
                };

                // Wait 3 seconds to verify the process stays running
                setTimeout(() => {
                    if (hasExited) {
                        this.log(`  ✗ ${app.name} exited before validation period`, 'red');
                        reject(new Error(`Process exited within 3 seconds`));
                    } else {
                        this.log(`  ✓ ${app.name} started successfully`, 'green');
                        this.log(`    PID: ${child.pid}`, 'green');
                        this.log(`    Stdout log: ${stdoutLog}`, 'green');
                        this.log(`    Stderr log: ${stderrLog}`, 'green');
                        
                        this.processes.set(app.logPrefix, processInfo);
                        combinedStream.write(`✓ ${app.name} started successfully at ${new Date().toISOString()}\n\n`);
                        resolve(child);
                    }
                }, 3000);
            });

            child.on('error', (error) => {
                hasExited = true;
                this.log(`  ✗ Failed to start ${app.name}: ${error.message}`, 'red');
                combinedStream.write(`✗ Failed to start ${app.name}: ${error.message} at ${new Date().toISOString()}\n\n`);
                reject(error);
            });

            child.on('exit', (code, signal) => {
                hasExited = true;
                this.log(`  ! ${app.name} exited with code ${code} signal ${signal}`, 'yellow');
                combinedStream.write(`! ${app.name} exited with code ${code} signal ${signal} at ${new Date().toISOString()}\n\n`);
                this.processes.delete(app.logPrefix);
                
                // If we haven't resolved yet, this is a failure
                if (processInfo && !this.processes.has(app.logPrefix)) {
                    // Process exited before validation period
                }
            });
        });
    }

    async startAll() {
        this.log('========================================', 'blue');
        this.log('  Presto Server Suite Node.js Manager  ', 'blue');
        this.log('========================================', 'blue');
        this.log(`Starting all ${APPLICATIONS.length} Presto applications...\n`, 'blue');

        let successCount = 0;
        const errors = [];

        for (const app of APPLICATIONS) {
            try {
                await this.startApplication(app);
                successCount++;
                // Wait a bit between starts to avoid port conflicts
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                errors.push({ app: app.name, error: error.message });
                this.log(`  Recent error details:`, 'red');
                this.log(`    ${error.message}`, 'red');
            }
        }

        // Final summary
        this.log('\n========================================', 'blue');
        if (successCount === APPLICATIONS.length) {
            this.log(`  All ${APPLICATIONS.length} applications started successfully!`, 'green');
        } else if (successCount > 0) {
            this.log(`  ${successCount}/${APPLICATIONS.length} applications started`, 'yellow');
        } else {
            this.log('  No applications started successfully', 'red');
        }
        this.log('========================================', 'blue');

        // Show running processes
        this.showStatus();

        // Show log information
        this.log('\nLog Files:', 'blue');
        this.log(`Individual Logs Directory: ${this.individualLogsDir}`, 'blue');
        this.log(`Combined Stderr Log: ${this.combinedErrorLog}`, 'blue');

        if (errors.length > 0) {
            this.log('\nErrors encountered:', 'red');
            errors.forEach(({ app, error }) => {
                this.log(`  ${app}: ${error}`, 'red');
            });
        }

        return { successCount, totalCount: APPLICATIONS.length, errors };
    }

    showStatus() {
        const { execSync } = require('child_process');
        
        this.log('\nRunning Processes:', 'blue');
        
        // For each application, check if there are processes running
        APPLICATIONS.forEach(app => {
            try {
                let processFound = false;
                
                // Try to find processes by script name (Windows/Linux compatible)
                try {
                    if (process.platform === 'win32') {
                        // Windows: Use wmic to get command line arguments
                        const cmd = `wmic process where "name='node.exe'" get processid,commandline /format:csv`;
                        const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
                        
                        // Check if any command line contains our script
                        if (result.includes(app.script)) {
                            processFound = true;
                            this.log(`  ✓ ${app.name} - Running`, 'green');
                        }
                    } else {
                        // Linux/macOS: Use ps and grep
                        const cmd = `ps aux | grep "${app.script}" | grep -v grep`;
                        const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
                        if (result.trim()) {
                            processFound = true;
                            this.log(`  ✓ ${app.name} - Running`, 'green');
                        }
                    }
                } catch (e) {
                    // Command failed, process not found
                }
                
                if (!processFound) {
                    this.log(`  ✗ ${app.name} - Not running`, 'red');
                }
                
            } catch (error) {
                this.log(`  ? ${app.name} - Status unknown`, 'yellow');
            }
        });
        
        // Also show processes tracked by this manager instance
        if (this.processes.size > 0) {
            this.log('\nProcesses managed by this instance:', 'blue');
            this.processes.forEach((proc, key) => {
                const uptime = Math.floor((new Date() - proc.startTime) / 1000);
                this.log(`  ✓ ${proc.name} (PID: ${proc.pid}, Uptime: ${uptime}s)`, 'green');
            });
        }
    }

    async stopAll() {
        const { execSync } = require('child_process');
        
        this.log('Stopping all Presto applications...', 'yellow');
        
        // First, stop processes tracked by this manager instance
        if (this.processes.size > 0) {
            this.log('Stopping processes tracked by this manager...', 'blue');
            const promises = Array.from(this.processes.values()).map(proc => {
                return new Promise(resolve => {
                    proc.process.on('exit', resolve);
                    proc.process.kill('SIGTERM');
                    
                    // Force kill after 5 seconds if not terminated
                    setTimeout(() => {
                        if (!proc.process.killed) {
                            proc.process.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                });
            });
            await Promise.all(promises);
        }
        
        // Also try to kill any Node.js processes running our applications
        this.log('Looking for other Presto processes...', 'blue');
        let stoppedCount = 0;
        
        for (const app of APPLICATIONS) {
            try {
                if (process.platform === 'win32') {
                    // Windows: Use wmic to find processes by command line, then kill by PID
                    const cmd = `wmic process where "name='node.exe'" get processid,commandline /format:csv`;
                    const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
                    
                    // Parse CSV output to find PIDs of processes running our script
                    const lines = result.split('\n').filter(line => line.trim() && line.includes(app.script));
                    
                    for (const line of lines) {
                        // Extract PID from CSV line (format: Node,CommandLine,ProcessId)
                        const parts = line.split(',');
                        if (parts.length >= 3) {
                            const pid = parts[parts.length - 1].trim();
                            if (pid && !isNaN(pid)) {
                                try {
                                    execSync(`taskkill /f /pid ${pid}`, { timeout: 5000, stdio: 'ignore' });
                                    stoppedCount++;
                                    this.log(`  ✓ Stopped ${app.name} (PID: ${pid})`, 'green');
                                } catch (e) {
                                    // Process might have already terminated
                                }
                            }
                        }
                    }
                } else {
                    // Linux/macOS: Use pkill
                    const result = execSync(`pgrep -f "${app.script}"`, { encoding: 'utf8', timeout: 5000 });
                    if (result.trim()) {
                        execSync(`pkill -f "${app.script}"`, { timeout: 5000, stdio: 'ignore' });
                        stoppedCount++;
                        this.log(`  ✓ Stopped ${app.name}`, 'green');
                    }
                }
            } catch (error) {
                // Process not found or already stopped
            }
        }
        
        if (stoppedCount > 0) {
            this.log(`Stopped ${stoppedCount} processes`, 'green');
        } else {
            this.log('No running processes found', 'yellow');
        }
    }

    async restart() {
        await this.stopAll();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.startAll();
    }
}

// Simple background mode - just run and exit after starting
async function runInBackground(manager) {
    console.log('Starting all Presto applications...');
    
    const result = await manager.startAll();
    
    if (result.successCount > 0) {
        console.log(`Successfully started ${result.successCount} of ${result.totalCount} applications`);
        console.log('Applications are now running independently');
        console.log('Use "node presto-manager.js status" to check running processes');
        console.log('Use "node presto-manager.js stop" to stop all processes');
    } else {
        console.log('No applications started successfully');
    }
    
    // Exit after starting - applications run independently
    process.exit(result.successCount > 0 ? 0 : 1);
}

// Command line interface
async function main() {
    const manager = new PrestoManager();
    const command = process.argv[2] || 'start';

    try {
        switch (command) {
            case 'start':
                // Simple background mode - start applications and exit
                await runInBackground(manager);
                break;
                
            case 'start-foreground':
                // Foreground mode - stay running to manage processes
                const result = await manager.startAll();
                if (result.successCount > 0) {
                    process.on('SIGINT', async () => {
                        console.log('\nReceived SIGINT, stopping all processes...');
                        await manager.stopAll();
                        process.exit(0);
                    });
                    
                    process.on('SIGTERM', async () => {
                        console.log('\nReceived SIGTERM, stopping all processes...');
                        await manager.stopAll();
                        process.exit(0);
                    });
                    
                    console.log('\nRunning in foreground mode. Press Ctrl+C to stop all processes and exit');
                    // Keep alive
                    setInterval(() => {
                        // Heartbeat - could add health checks here
                    }, 30000);
                } else {
                    console.log('No processes started successfully');
                    process.exit(1);
                }
                break;
                
            case 'stop':
                await manager.stopAll();
                break;
                
            case 'restart':
                await manager.restart();
                break;
                
            case 'status':
                manager.showStatus();
                break;
                
            default:
                console.log('Usage: node presto-manager.js [start|start-foreground|stop|restart|status]');
                console.log('');
                console.log('Commands:');
                console.log('  start             Start all applications and exit (background mode)');
                console.log('  start-foreground  Start all applications and stay running (foreground mode)');
                console.log('  stop              Stop all running applications');
                console.log('  restart           Restart all applications');
                console.log('  status            Show status of all applications');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PrestoManager;