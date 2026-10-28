param([switch]$RunBashCommand)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class TestProcessIOPriority {
    [DllImport("ntdll.dll")]
    public static extern int NtSetInformationProcess(
        IntPtr process, int informationClass, ref int information, int size);

    [DllImport("ntdll.dll")]
    public static extern int NtQueryInformationProcess(
        IntPtr process, int informationClass, out int information, int size, out int length);
}
'@

$priority = 0
$length = 0
$status = [TestProcessIOPriority]::NtQueryInformationProcess(
    [IntPtr](-1), 33, [ref]$priority, 4, [ref]$length)
if ($status -ne 0) {
    throw ('Reading I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
$inheritedPriority = $priority
$priority = 2
$status = [TestProcessIOPriority]::NtSetInformationProcess(
    [IntPtr](-1), 33, [ref]$priority, 4)
if ($status -ne 0) {
    throw ('Setting normal I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
$status = [TestProcessIOPriority]::NtQueryInformationProcess(
    [IntPtr](-1), 33, [ref]$priority, 4, [ref]$length)
if ($status -ne 0) {
    throw ('Reading I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
if ($priority -ne 2) {
    throw "Expected normal I/O priority (2), got $priority"
}
Write-Host "Test launcher I/O priority: $inheritedPriority -> $priority (Normal)"

if ($RunBashCommand) {
    & "$env:ProgramFiles\Git\bin\bash.exe" --noprofile --norc -eo pipefail -c $env:PW_TEST_COMMAND
    exit $LASTEXITCODE
}
