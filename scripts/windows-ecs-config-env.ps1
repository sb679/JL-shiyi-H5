[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '')]
param()

$ErrorActionPreference = 'Stop'

function Read-Required($Prompt, $DefaultValue = '') {
  do {
    if ([string]::IsNullOrWhiteSpace($DefaultValue)) {
      $Value = Read-Host $Prompt
    } else {
      $Value = Read-Host "$Prompt, press Enter to use $DefaultValue"
      if ([string]::IsNullOrWhiteSpace($Value)) {
        $Value = $DefaultValue
      }
    }
  } while ([string]::IsNullOrWhiteSpace($Value))
  return $Value.Trim()
}

function Read-RequiredSecret($Prompt) {
  do {
    $SecureValue = Read-Host $Prompt -AsSecureString
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
      $Value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
    }
  } while ([string]::IsNullOrWhiteSpace($Value))
  return $Value.Trim()
}

function Set-MachineEnv($Name, $Value) {
  [Environment]::SetEnvironmentVariable($Name, $Value, 'Machine')
  [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

Write-Host "Configuring JL Shiyi H5 runtime environment variables." -ForegroundColor Cyan
Write-Host "Secrets are written to Windows Machine environment variables, not to Git-tracked source files." -ForegroundColor Yellow

$Values = @{
  PORT = Read-Required 'PORT' '8080'
  OSS_REGION = Read-Required 'OSS_REGION, for example oss-cn-hangzhou'
  OSS_BUCKET = Read-Required 'OSS_BUCKET'
  OSS_ACCESS_KEY_ID = Read-Required 'OSS_ACCESS_KEY_ID'
  OSS_ACCESS_KEY_SECRET = Read-RequiredSecret 'OSS_ACCESS_KEY_SECRET'
  OSS_PUBLIC_BASE_URL = ''
  UPLOAD_MAX_FILE_SIZE = '8388608'
  UPLOAD_MAX_FILES = '30'
  MYSQL_HOST = Read-Required 'MYSQL_HOST / RDS endpoint' 'rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com'
  MYSQL_PORT = Read-Required 'MYSQL_PORT' '3306'
  MYSQL_DATABASE = Read-Required 'MYSQL_DATABASE' 'jl_shiyi_app'
  MYSQL_USER = Read-Required 'MYSQL_USER' 'jl_shiyi_app'
  MYSQL_PASSWORD = Read-RequiredSecret 'MYSQL_PASSWORD / RDS password'
}

$OssPublicBaseUrl = Read-Host 'OSS_PUBLIC_BASE_URL, press Enter to auto-generate'
if ([string]::IsNullOrWhiteSpace($OssPublicBaseUrl)) {
  $OssPublicBaseUrl = "https://$($Values.OSS_BUCKET).$($Values.OSS_REGION).aliyuncs.com"
}
$Values.OSS_PUBLIC_BASE_URL = $OssPublicBaseUrl.Trim()

foreach ($Name in $Values.Keys) {
  Set-MachineEnv $Name $Values[$Name]
}

Write-Host "Runtime environment variables configured." -ForegroundColor Green
Write-Host "Restart the JL Shiyi scheduled task or reboot the ECS instance for services to pick up Machine environment changes." -ForegroundColor Yellow
