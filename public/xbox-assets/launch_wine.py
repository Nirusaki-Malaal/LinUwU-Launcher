#!/usr/bin/env python3
"""Launch an executable or the optional GDK helper in a chosen Wine prefix."""

import argparse
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys


RUNTIME_DIRECTORY = Path.home() / '.local/share/xodus-nexus/runtimes'
WINE_RELATIVE_PATH = Path(
    'releases/nexus-runtime-11.0-experimental-g76c6dd13/files/bin/wine'
)
HELPER = Path.cwd() / 'GDK_Helper.bat'
DEFAULT_PREFIX = Path.home() / '.local/share/xgamemode-runtime/prefix'
DEFAULT_DLL_OVERRIDES = (
    'OnlineFix64=n;SteamOverlay64=n;winmm=n,b;dnet=n;steam_api64=n;winhttp=n,b'
)


def local_path(value):
    return Path(value).expanduser().resolve()


def install_runtime_dependencies(wine, prefix, dry_run=False):
    """Install missing bundled native dependencies; preserve existing prefix DLLs."""
    runtime_files = wine.parent.parent
    names = ('libvkd3d-1.dll', 'libvkd3d-shader-1.dll', 'libvkd3d-utils-1.dll')
    for architecture, directory in (('x86_64-windows', 'system32'),
                                    ('i386-windows', 'syswow64')):
        destination = prefix / 'drive_c/windows' / directory
        for name in names:
            source = runtime_files / 'lib/vkd3d' / architecture / name
            target = destination / name
            if not source.is_file() or target.exists() or target.is_symlink():
                continue
            print(f'Install bundled runtime DLL: {directory}/{name}', flush=True)
            if not dry_run:
                destination.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        # WinHTTP loads nghttp2 dynamically for HTTP/2. Wine's builtin DLL
        # directory does not make this native dependency available in a prefix.
        source = runtime_files / 'lib/wine' / architecture / 'libnghttp2.dll'
        target = destination / 'libnghttp2.dll'
        if source.is_file() and not target.exists() and not target.is_symlink():
            print(f'Install bundled runtime DLL: {directory}/libnghttp2.dll', flush=True)
            if not dry_run:
                destination.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefix', type=local_path,
                        help=f'Wine prefix directory (default: {DEFAULT_PREFIX})')
    parser.add_argument('--runtime-dir', type=local_path, default=RUNTIME_DIRECTORY,
                        help='Directory containing the runtime releases')
    parser.add_argument('--wine', type=local_path,
                        help='Override the Wine executable path')
    parser.add_argument('--dll-overrides', default=DEFAULT_DLL_OVERRIDES,
                        help='Replace the default WINEDLLOVERRIDES string')
    parser.add_argument('--helper', action='store_true',
                        help='Run the interactive GDK helper instead of an executable')
    parser.add_argument('--helper-path', type=local_path, default=HELPER)
    parser.add_argument('--dry-run', action='store_true',
                        help='Print the launch settings without running Wine')
    parser.add_argument('--virtual-desktop', metavar='WIDTHxHEIGHT',
                        help='Run the game inside a Wine virtual desktop')
    parser.add_argument('exe', nargs='?', type=local_path,
                        help='Linux filesystem path to the Windows executable')
    parser.add_argument('exe_args', nargs=argparse.REMAINDER,
                        help='Arguments passed to the executable')
    args = parser.parse_args()
    if args.virtual_desktop:
        dimensions = args.virtual_desktop.lower().split('x')
        if (len(dimensions) != 2 or not all(part.isdigit() and 320 <= int(part) <= 16384
                                            for part in dimensions)):
            parser.error('--virtual-desktop must be WIDTHxHEIGHT, for example 1280x720')
        args.virtual_desktop = 'x'.join(dimensions)
        if args.helper:
            parser.error('--virtual-desktop is for executable launches only')
    using_default_prefix = args.prefix is None
    args.prefix = args.prefix or DEFAULT_PREFIX

    if args.helper and (args.exe or args.exe_args):
        parser.error('--helper runs separately; omit the executable and its arguments')
    if not args.helper and args.exe is None:
        parser.error('provide an executable path or use --helper')

    wine = args.wine or args.runtime_dir / WINE_RELATIVE_PATH
    if not wine.is_file() or not os.access(wine, os.X_OK):
        parser.error(f'Wine executable is missing or not executable: {wine}')
    target = args.helper_path if args.helper else args.exe
    if not target.is_file():
        parser.error(f'File does not exist: {target}')
    env = os.environ.copy()
    env['WINEPREFIX'] = str(args.prefix)
    env['PATH'] = str(wine.parent) + os.pathsep + env.get('PATH', '')
    env['WINEDLLOVERRIDES'] = args.dll_overrides

    initialized = ((args.prefix / 'system.reg').is_file()
                   and (args.prefix / 'drive_c').is_dir())
    if not initialized:
        if not using_default_prefix:
            parser.error(f'Not an initialized Wine prefix: {args.prefix}')
        if args.prefix.exists() and not args.prefix.is_dir():
            parser.error(f'Prefix path is not a directory: {args.prefix}')
        print(f'Initialize default Wine prefix: {args.prefix}', flush=True)
        if not args.dry_run:
            wineserver = wine.parent / 'wineserver'
            if not wineserver.is_file() or not os.access(wineserver, os.X_OK):
                parser.error(f'Missing executable for initialization: {wineserver}')
            args.prefix.mkdir(parents=True, exist_ok=True)
            subprocess.run([str(wine), 'wineboot.exe', '--init'],
                           cwd=target.parent, env=env, check=True)
            # wineboot can exit before wineserver flushes the registry to disk.
            print('Waiting for Wine prefix setup to finish...', flush=True)
            try:
                subprocess.run([str(wineserver), '--wait'], env=env,
                               check=True, timeout=120)
            except subprocess.TimeoutExpired:
                print('Wine setup is still running after 120 seconds. '
                      'Let it finish, then retry; the prefix has been preserved.',
                      file=sys.stderr)
                return 1
            if not ((args.prefix / 'system.reg').is_file()
                    and (args.prefix / 'drive_c').is_dir()):
                parser.error(f'Wine did not initialize the prefix: {args.prefix}')

    install_runtime_dependencies(wine, args.prefix, dry_run=args.dry_run)

    if args.helper:
        # Use Wine's path conversion so prefixes with custom drive mappings work.
        if not args.dry_run:
            converted = subprocess.run(
                [str(wine), 'winepath.exe', '-w', str(target)], env=env,
                text=True, stdout=subprocess.PIPE, check=True,
            ).stdout.strip()
            if not converted:
                parser.error(f'Wine returned an empty Windows path for: {target}')
            # Wine quotes argv for Windows; embedded quotes become literal \".
            command = [str(wine), 'cmd', '/d', '/c', converted]
        else:
            command = [str(wine), 'cmd', '/d', '/c', '<Windows helper path from winepath>']
    else:
        command = [str(wine), str(target), *args.exe_args]
        if args.virtual_desktop:
            command = [str(wine), 'explorer.exe',
                       f'/desktop=NMS,{args.virtual_desktop}', str(target), *args.exe_args]

    print(f'WINEPREFIX={env["WINEPREFIX"]}', flush=True)
    print(f'WINEDLLOVERRIDES={env.get("WINEDLLOVERRIDES", "(unset)")}', flush=True)
    print(f'Working directory: {target.parent}', flush=True)
    if args.helper:
        print(f'Batch helper: {target}', flush=True)
    print(f'Command: {shlex.join(command)}', flush=True)
    if args.dry_run:
        return 0
    return subprocess.run(command, cwd=target.parent, env=env).returncode


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
    except (OSError, subprocess.CalledProcessError) as error:
        print(f'Launch failed: {error}', file=sys.stderr)
        sys.exit(1)
