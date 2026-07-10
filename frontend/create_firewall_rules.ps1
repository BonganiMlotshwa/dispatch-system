on the import # PowerShell script to create firewall rules for React application

# Define the ports used by our application
$ports = @(3000, 4000, 61637)

# Create inbound rules for each port
foreach ($port in $ports) {
    $ruleName = "ReactApp_Port_$port"
    
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    
    if ($existingRule -eq $null) {
        # Create new rule if it doesn't exist
        Write-Host "Creating firewall rule for port $port..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any
        Write-Host "Rule created successfully."
    } else {
        Write-Host "Rule for port $port already exists."
    }
}

Write-Host "\nFirewall rules have been created or verified for all application ports."
Write-Host "Your application should now be accessible from other devices on the network."
Write-Host "Use these URLs to access from other devices:"
Write-Host "Development server: http://192.168.68.88:3000"
Write-Host "Production server: http://192.168.68.88:4000"
Write-Host "Static file server: http://192.168.68.88:61637"