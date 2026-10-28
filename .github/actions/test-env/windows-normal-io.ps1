# Raises a process to normal I/O priority; the processes it starts afterwards inherit it. The
# self-hosted Windows runners start steps at Low, which the driver and the browsers inherit, and
# Firefox storage flushes then stall until the tests time out (microsoft/playwright#43704).
# Dot-source it at the start of a pwsh step to raise that step's shell, or run it with -ProcessId
# from another shell, as exec.sh does for its own Git Bash process before it runs the command.
param([int]$ProcessId = $PID)

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

$process = [System.Diagnostics.Process]::GetProcessById($ProcessId)
$priority = 0
$length = 0
$status = [TestProcessIOPriority]::NtQueryInformationProcess(
    $process.Handle, 33, [ref]$priority, 4, [ref]$length)
if ($status -ne 0) {
    throw ('Reading I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
$inheritedPriority = $priority
$priority = 2
$status = [TestProcessIOPriority]::NtSetInformationProcess(
    $process.Handle, 33, [ref]$priority, 4)
if ($status -ne 0) {
    throw ('Setting normal I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
$status = [TestProcessIOPriority]::NtQueryInformationProcess(
    $process.Handle, 33, [ref]$priority, 4, [ref]$length)
if ($status -ne 0) {
    throw ('Reading I/O priority failed: NTSTATUS 0x{0:X8}' -f $status)
}
if ($priority -ne 2) {
    throw "Expected normal I/O priority (2), got $priority"
}
Write-Host "I/O priority of $($process.ProcessName) (${ProcessId}): $inheritedPriority -> $priority (Normal)"
