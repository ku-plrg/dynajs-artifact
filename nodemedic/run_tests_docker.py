#!/usr/bin/env python3

import argparse
import csv
import shlex
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple


@dataclass(frozen=True)
class PackageEntry:
    package_name: str
    version: str
    package_key: str
    exploitable: str
    confirmed: str


@dataclass(frozen=True)
class PackageRunResult:
    package: PackageEntry
    status: str
    elapsed_seconds: float
    exit_code: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run one package per Docker container with a fixed worker pool."
    )
    parser.add_argument(
        "--csv",
        default="filtered_flows_positive.csv",
        help="CSV with package, version, exploitable, confirmed columns",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only run the first N packages after de-duplication (0 = all)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of simultaneous Docker containers",
    )
    parser.add_argument(
        "--image",
        default="nodemedic:latest",
        help="Docker image to run for each package",
    )
    parser.add_argument(
        "--out-dir",
        default="docker_results_dynajs",
        help="Directory to store per-package artifacts and logs",
    )
    parser.add_argument(
        "--mode",
        default="full",
        choices=["gather", "analysis", "full"],
        help="Mode passed to the container entrypoint",
    )
    parser.add_argument(
        "--flags",
        default="--dynajs",
        help="Additional pipeline flags passed through entrypoint.sh",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1,
        help="Batch size passed to entrypoint.sh",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Per-container timeout in seconds passed to entrypoint.sh",
    )
    parser.add_argument(
        "--platform",
        default="",
        help="Optional Docker platform, for example linux/amd64",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip packages that already have a completed per-package log in --out-dir",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the packages that would be run and exit without starting Docker",
    )
    parser.add_argument(
        "--verdaccio",
        action="store_true",
        help="Pass --verdaccio to the container entrypoint",
    )
    parser.add_argument(
        "--stop-on-1st-exploited",
        action="store_true",
        default=True,
        help="Pass --stop-on-1st-exploited to the container entrypoint",
    )
    parser.add_argument(
        "--no-stop-on-1st-exploited",
        dest="stop_on_1st_exploited",
        action="store_false",
        help="Do not pass --stop-on-1st-exploited to the container entrypoint",
    )
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("--limit must be >= 0")
    if args.workers < 1:
        parser.error("--workers must be >= 1")
    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")
    if args.timeout < 1:
        parser.error("--timeout must be >= 1")
    return args


def safe_log_name(package_key: str) -> str:
    return "".join("_" if c in '/\\:*?"<>|' else c for c in package_key)


def mkdirp(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_packages_from_csv(csv_path: Path, limit: int) -> List[PackageEntry]:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    with csv_path.open("r", encoding="utf8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"package", "version"}
        if reader.fieldnames is None or not required.issubset(reader.fieldnames):
            raise ValueError(
                "CSV must have headers: package, version"
            )

        seen = set()
        packages: List[PackageEntry] = []
        for row in reader:
            package_name = (row.get("package") or "").strip()
            version = (row.get("version") or "").strip()
            exploitable = (row.get("exploitable") or "").strip().lower()
            confirmed = (row.get("confirmed") or "").strip().lower()
            if not package_name or not version:
                continue

            package_key = f"{package_name}@{version}"
            if package_key in seen:
                continue
            seen.add(package_key)
            packages.append(
                PackageEntry(
                    package_name=package_name,
                    version=version,
                    package_key=package_key,
                    exploitable=exploitable,
                    confirmed=confirmed,
                )
            )

    if limit > 0:
        return packages[:limit]
    return packages


def format_elapsed(elapsed_seconds: float) -> str:
    total_seconds = int(round(elapsed_seconds))
    hours, rem = divmod(total_seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours > 0:
        return f"{hours:d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:d}:{seconds:02d}"


def build_docker_command(
    package: PackageEntry,
    package_artifact_dir: Path,
    args: argparse.Namespace,
) -> List[str]:
    docker_command = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{package_artifact_dir.resolve()}:/nodetaint/analysisArtifacts:rw",
    ]
    if args.platform:
        docker_command.extend(["--platform", args.platform])

    docker_command.append(args.image)
    docker_command.extend(
        [
            "/nodetaint/entrypoint.sh",
            f"--package={package.package_name}",
            f"--version={package.version}",
            f"--mode={args.mode}",
            f"--flags={args.flags}",
            f"--batch-size={args.batch_size}",
            f"--timeout={args.timeout}",
        ]
    )
    if args.verdaccio:
        docker_command.append("--verdaccio")
    if args.stop_on_1st_exploited:
        docker_command.append("--stop-on-1st-exploited")

    return [
        # "/usr/bin/time",
        # "-f",
        # "real %e\nuser %U\nsys %S",
        *docker_command,
    ]


def classify_result(log_path: Path) -> str:
    try:
        content = log_path.read_text(encoding="utf8", errors="replace")
    except OSError:
        return "FAIL"
    if "Exploit(s) found for functions" in content:
        return "SUCCESS"
    return "FAIL"


def is_completed_log(log_path: Path) -> bool:
    try:
        content = log_path.read_text(encoding="utf8", errors="replace")
    except OSError:
        return False
    if "\nexit_code " in content or content.startswith("exit_code "):
        return True
    if "Done with analysis" in content:
        return True
    return "\nreal " in content and "\nuser " in content and "\nsys " in content


def filter_completed_packages(
    packages: List[PackageEntry],
    out_dir: Path,
) -> Tuple[List[PackageEntry], int]:
    logs_dir = out_dir / "logs"
    remaining: List[PackageEntry] = []
    skipped = 0
    for package in packages:
        log_base = safe_log_name(package.package_key)
        log_path = logs_dir / f"{log_base}.out"
        if is_completed_log(log_path):
            skipped += 1
        else:
            remaining.append(package)
    return remaining, skipped


def run_one_package(package: PackageEntry, args: argparse.Namespace, out_dir: Path) -> PackageRunResult:
    log_base = safe_log_name(package.package_key)
    logs_dir = out_dir / "logs"
    artifacts_root = out_dir / "analysisArtifacts"
    package_artifact_dir = artifacts_root / log_base
    log_path = logs_dir / f"{log_base}.out"

    mkdirp(logs_dir)
    if package_artifact_dir.exists():
        shutil.rmtree(package_artifact_dir)
    mkdirp(package_artifact_dir)

    docker_cmd = build_docker_command(package, package_artifact_dir, args)

    start = time.monotonic()
    with log_path.open("w", encoding="utf8") as log_handle:
        log_handle.write("$ " + shlex.join(docker_cmd) + "\n")
        log_handle.flush()
        proc = subprocess.run(
            docker_cmd,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
    elapsed_seconds = time.monotonic() - start
    with log_path.open("a", encoding="utf8") as log_handle:
        log_handle.write(f"exit_code {proc.returncode}\n")
    status = classify_result(log_path)
    return PackageRunResult(
        package=package,
        status=status,
        elapsed_seconds=elapsed_seconds,
        exit_code=proc.returncode,
    )


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir)
    mkdirp(out_dir)
    mkdirp(out_dir / "logs")
    mkdirp(out_dir / "analysisArtifacts")

    packages = load_packages_from_csv(Path(args.csv), args.limit)
    original_count = len(packages)
    if args.resume:
        packages, skipped = filter_completed_packages(packages, out_dir)
        print(f"[+] Resume: skipped {skipped} completed package(s), {len(packages)} remaining")
        if skipped > original_count:
            raise AssertionError("skipped more packages than loaded")

    print("[+] Execution order:")
    for package in packages:
        print(package.package_key)

    print("")
    print(f"[+] Image: {args.image}")
    print(f"[+] Running {len(packages)} packages with {args.workers} worker(s)")
    if args.dry_run:
        return 0

    results = {}
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_map = {
            executor.submit(run_one_package, package, args, out_dir): package
            for package in packages
        }
        for future in as_completed(future_map):
            package = future_map[future]
            try:
                result = future.result()
            except Exception as err:
                result = PackageRunResult(
                    package=package,
                    status="FAIL",
                    elapsed_seconds=0.0,
                    exit_code=1,
                )
                log_base = safe_log_name(package.package_key)
                log_path = out_dir / "logs" / f"{log_base}.out"
                with log_path.open("a", encoding="utf8") as log_handle:
                    log_handle.write(f"\n[runner-error] {err}\n")
            results[package.package_key] = result

    success = 0
    fail = 0
    print("")
    for package in packages:
        result = results[package.package_key]
        elapsed = format_elapsed(result.elapsed_seconds)
        exit_suffix = "" if result.exit_code == 0 else f", exit={result.exit_code}"
        print(f"\t[{result.status:<7}] {package.package_key} ({elapsed}{exit_suffix})")
        if result.status == "SUCCESS":
            success += 1
        else:
            fail += 1

    print("")
    print(f"[+] Results: SUCCESS={success}  FAIL={fail}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
