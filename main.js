const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
// require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: '/Applications/mailhog-gui.app/Contents/.env' });

let mailHogProcess;
let mainWindow;
let configWindow;


function startMailHog(smtpBindAddr, uiBindAddr) {
    // const mailHogPath = path.join(app.getAppPath(), 'bin', 'MailHog');
    const mailHogPath = '/Applications/mailhog-gui.app/Contents/bin/MailHog';

    console.log("Attempting to start MailHog...");

    mailHogProcess = spawn(mailHogPath, [
        '-smtp-bind-addr',
        smtpBindAddr,
        '-ui-bind-addr',
        uiBindAddr,
        '-api-bind-addr',
        uiBindAddr,
    ]);

    const logOutput = (data) => {
        const message = data.toString().trim();
        if (message.includes('error') || message.includes('failed') || message.includes('invalid') || message.includes('not found')) {
            console.error(`MailHog error: ${message}`);
        } else {
            console.log(`MailHog: ${message}`);
        }
    };

    mailHogProcess.stdout.on('data', logOutput);
    mailHogProcess.stderr.on('data', logOutput);
    mailHogProcess.on('close', (code) => {
        console.log(`MailHog process exited with code ${code}`);
    });
}

function isMailHogRunning(callback) {
    http.get('http://' + process.env.API_BIND_ADDR, (res) => {
        callback(res.statusCode === 200);
    }).on('error', () => {
        callback(false);
    });
}

function startMailHogAndCheck(smtpBindAddr, uiBindAddr) {
    startMailHog(smtpBindAddr, uiBindAddr);

    const checkInterval = setInterval(() => {
        isMailHogRunning((isRunning) => {
            console.log(`Checking MailHog status: ${isRunning ? 'Running' : 'Not Running'}`);
            if (isRunning) {
                clearInterval(checkInterval);
                createMainWindow();
            }
        });
    }, 1000);
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    mainWindow.loadURL('http://' + process.env.UI_BIND_ADDR);

    mainWindow.on('closed', () => {
        if (mailHogProcess) {
            mailHogProcess.kill();
        }
        mainWindow = null;
        app.quit();
    });
}

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 400,
        height: 450,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    configWindow.loadFile('config.html'); 

    configWindow.on('close', (event) => {
        setTimeout(function(){
            if (!mainWindow) {
                app.quit();
              }
        }, 2000);        
      });
    
}

ipcMain.on('submit-config', (event, smtpBindAddr, uiBindAddr) => {
    process.env.SMTP_BIND_ADDR = smtpBindAddr;
    process.env.UI_BIND_ADDR = uiBindAddr;
    process.env.API_BIND_ADDR = uiBindAddr;

    startMailHogAndCheck(smtpBindAddr, uiBindAddr);
    configWindow.close();

});

app.whenReady().then(() => {
    createConfigWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createConfigWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (mailHogProcess) {
        mailHogProcess.kill();
    }
});
