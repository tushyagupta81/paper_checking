// import { app, BrowserWindow } from "electron";
// import path from "path";

// app.on("ready", () => {
//   const mainWindow = new BrowserWindow({});
//   mainWindow.loadFile(path.join(app.getAppPath() , "/dist-react/index.html"))
// })


import { app, BrowserWindow } from "electron";
import path from "path";

/**
 * Creates the main application window.
 */
app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    width: 1200, 
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Load the compiled React application's index.html
  mainWindow.loadFile(path.join(app.getAppPath() , "/dist-react/index.html"));
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create a window when the dock icon is clicked 
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
