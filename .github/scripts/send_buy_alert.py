from __future__ import annotations

import json
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path


DEFAULT_RECIPIENTS = [
    "fricachai@gmail.com",
    "frica@mail.ctbctech.edu.tw",
]
BUY_REMINDER_LOOKBACK = 10
TRACKED_INSTRUMENTS = {
    "0050": {
        "name": "Yuanta Taiwan 50",
        "path": Path("data/0050.json"),
        "mode": "drawdown",
        "min_drop": 5.0,
        "max_drop": 7.0,
        "add_on_drop": 7.0,
    },
    "0056": {
        "name": "Yuanta High Dividend",
        "path": Path("data/0056.json"),
        "mode": "drawdown",
        "min_drop": 6.0,
        "max_drop": 8.0,
        "add_on_drop": 8.0,
    },
    "00878": {
        "name": "Cathay Sustainable High Dividend",
        "path": Path("data/00878.json"),
        "mode": "drawdown",
        "min_drop": 4.5,
        "max_drop": 5.5,
        "add_on_drop": 5.0,
    },
    "006208": {
        "name": "Fubon Taiwan 50",
        "path": Path("data/006208.json"),
        "mode": "drawdown",
        "min_drop": 5.0,
        "max_drop": 7.0,
        "add_on_drop": 7.0,
    },
    "TPE: IX0001": {
        "name": "Taiwan Weighted Index",
        "path": Path("data/taiex.json"),
        "mode": "kd-k",
        "range_min": 20.0,
        "range_max": 30.0,
        "oversold_max": 20.0,
    },
}


def get_recipient_emails() -> list[str]:
    raw = os.environ.get("ALERT_TO_EMAILS", "").strip()
    if raw:
        recipients = [item.strip() for item in raw.split(",") if item.strip()]
        if recipients:
            return recipients
    return DEFAULT_RECIPIENTS


def load_candles(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_kd(candles: list[dict]) -> dict[str, list[float | None]]:
    k: list[float | None] = [None] * len(candles)
    d: list[float | None] = [None] * len(candles)
    prev_k = 50.0
    prev_d = 50.0

    for i in range(len(candles)):
        start = max(0, i - 8)
        window = candles[start : i + 1]
        highest = max(float(candle["high"]) for candle in window)
        lowest = min(float(candle["low"]) for candle in window)
        close = float(candles[i]["close"])
        rsv = 50.0 if highest == lowest else ((close - lowest) / (highest - lowest)) * 100.0
        current_k = (2.0 / 3.0) * prev_k + (1.0 / 3.0) * rsv
        current_d = (2.0 / 3.0) * prev_d + (1.0 / 3.0) * current_k
        k[i] = current_k
        d[i] = current_d
        prev_k = current_k
        prev_d = current_d

    return {"k": k, "d": d}


def format_rule_text(min_drop: float, max_drop: float, add_on_drop: float) -> str:
    def fmt(value: float) -> str:
        return f"{int(value)}" if float(value).is_integer() else f"{value:.1f}"

    if min_drop == max_drop:
        return f"10-day close drop -{fmt(min_drop)}% (add on at -{fmt(add_on_drop)}%)"
    return (
        f"10-day close drop -{fmt(min_drop)}% ~ -{fmt(max_drop)}% "
        f"(add on at -{fmt(add_on_drop)}%)"
    )


def calculate_drawdown_window(candles: list[dict], end_index: int, lookback: int = BUY_REMINDER_LOOKBACK) -> dict | None:
    if end_index < 0 or end_index >= len(candles):
        return None

    start_index = end_index - lookback + 1
    if start_index < 0:
        return None

    base_close = None
    base_index = -1
    for index in range(start_index, end_index + 1):
        close = float(candles[index]["close"])
        if base_close is None or close > base_close:
            base_close = close
            base_index = index

    current_close = float(candles[end_index]["close"])
    if base_close is None or base_close <= 0:
        return None

    drop_pct = ((base_close - current_close) / base_close) * 100
    return {
        "base_index": base_index,
        "base_close": base_close,
        "current_close": current_close,
        "drop_pct": drop_pct,
    }


def build_drawdown_alert_line(code: str, config: dict, candles: list[dict]) -> str | None:
    latest_index = len(candles) - 1
    drawdown = calculate_drawdown_window(candles, latest_index)
    if not drawdown:
        return None

    drop_pct = drawdown["drop_pct"]
    if not (config["min_drop"] <= drop_pct <= config["max_drop"]):
        return None

    latest_candle = candles[latest_index]
    base_candle = candles[drawdown["base_index"]]
    rule_text = format_rule_text(config["min_drop"], config["max_drop"], config["add_on_drop"])
    return (
        f"{code} {config['name']} | date {latest_candle['date'][:10]} | "
        f"signal triggered | current drop {drop_pct:.2f}% | "
        f"base close {drawdown['base_close']:.2f} ({base_candle['date'][:10]}) | "
        f"latest close {drawdown['current_close']:.2f} | {rule_text}"
    )


def build_k_signal_alert_line(code: str, config: dict, candles: list[dict]) -> str | None:
    kd = compute_kd(candles)
    latest_index = len(candles) - 1
    k_value = kd["k"][latest_index]
    if k_value is None:
        return None

    latest_candle = candles[latest_index]
    if k_value < config["oversold_max"]:
        signal_text = "K<20"
    elif config["range_min"] <= k_value <= config["range_max"]:
        signal_text = "K: 20~30"
    else:
        return None

    return (
        f"{code} {config['name']} | date {latest_candle['date'][:10]} | "
        f"signal triggered | {signal_text} | "
        f"K {k_value:.2f} | close {float(latest_candle['close']):.2f}"
    )


def build_alert_lines() -> list[str]:
    lines: list[str] = []

    for code, config in TRACKED_INSTRUMENTS.items():
        candles = load_candles(config["path"])
        if not candles:
            continue
        if config["mode"] == "kd-k":
            line = build_k_signal_alert_line(code, config, candles)
        else:
            line = build_drawdown_alert_line(code, config, candles)
        if line:
            lines.append(line)

    return lines


def send_email(lines: list[str]) -> None:
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("ALERT_FROM_EMAIL") or username

    if not all([host, username, password, sender]):
        raise RuntimeError(
            "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ALERT_FROM_EMAIL."
        )

    recipients = get_recipient_emails()
    message = EmailMessage()
    message["Subject"] = "ETF / index buy point alert"
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    message.set_content(
        "The following tracked instruments triggered buy point alerts on the latest trading day:\n\n"
        + "\n".join(f"- {line}" for line in lines)
        + "\n\nThis email was sent automatically by GitHub Actions."
    )

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(message)


def main() -> None:
    lines = build_alert_lines()
    if not lines:
        print("No tracked instrument buy alerts today.")
        return

    send_email(lines)
    print("\n".join(lines))


if __name__ == "__main__":
    main()
