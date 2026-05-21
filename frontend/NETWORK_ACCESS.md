# Network Access Instructions

## Accessing the Application from Other Devices

The application is now configured to be accessible from other devices on your local network. Follow these steps to access it:

### Development Mode

1. Start the development server:
   ```
   npm start
   ```
   This will run the application on port 3000 and bind to all network interfaces.

2. Access the application from other devices using:
   ```
   http://192.168.68.88:3000
   ```
   (Replace the IP address with your computer's actual IP address)

### Production Mode

1. Build the application:
   ```
   npm run build
   ```

2. Serve the production build:
   ```
   npm run serve
   ```
   This will run the custom server on port 4000 and bind to all network interfaces.

3. Access the application from other devices using:
   ```
   http://192.168.68.88:4000
   ```
   (Replace the IP address with your computer's actual IP address)

## Quick Setup

For a quick setup of network access:

1. Run the `setup_network_access.bat` file by double-clicking it.
2. Follow the prompts to allow administrator access when requested.
3. The script will:
   - Open the network test page in your browser
   - Configure Windows Firewall to allow access to application ports

## Troubleshooting Network Access

If other devices cannot access the application, check the following:

1. **Firewall Settings**: Ensure Windows Firewall allows incoming connections to ports 3000, 4000, and any other ports used by the application.
   - **Option 1**: Run the provided PowerShell script as Administrator:
     ```
     Right-click on create_firewall_rules.ps1 > Run with PowerShell (as Administrator)
     ```
   - **Option 2**: Manually add firewall rules by running PowerShell as Administrator and executing:
     ```
     netsh advfirewall firewall add rule name="React App Dev" dir=in action=allow protocol=TCP localport=3000
     netsh advfirewall firewall add rule name="React App Prod" dir=in action=allow protocol=TCP localport=4000
     netsh advfirewall firewall add rule name="React App Static" dir=in action=allow protocol=TCP localport=61637
     ```

2. **Antivirus Software**: Check if your antivirus software is blocking the connections.

3. **Network Configuration**: Ensure all devices are on the same network and subnet.

4. **IP Address**: Verify you're using the correct IP address. You can find your IP address by running `ipconfig` in the command prompt.

5. **Port Availability**: Make sure no other services are using the same ports.

## Connectivity check

From another device on the network, open the React app (e.g. `http://<server-ip>:3000`) and confirm the dashboard loads. If it does not, verify firewall rules (see `setup_network_access.bat`) and that the backend API is reachable on port 8001.