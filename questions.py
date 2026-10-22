"""Edit this list to change the questions shown in NetQuest."""

QUESTIONS = [
    {
        "text": "Which protocol provides reliable, ordered delivery of data?",
        "options": ["IP", "TCP", "UDP", "ARP"],
        "answer": 1,
        "explanation": "TCP uses acknowledgements and retransmissions to provide reliable, ordered delivery.",
    },
    {
        "text": "What is the main job of DNS?",
        "options": ["Encrypt files", "Assign MAC addresses", "Translate domain names to IP addresses", "Block all packets"],
        "answer": 2,
        "explanation": "DNS helps devices find the IP address associated with a domain name.",
    },
    {
        "text": "Which device commonly forwards Ethernet frames using MAC addresses?",
        "options": ["Switch", "Modem", "Repeater", "Firewall rule"],
        "answer": 0,
        "explanation": "A switch learns MAC addresses and forwards frames to the appropriate port.",
    },
    {
        "text": "How long is an IPv4 address?",
        "options": ["16 bits", "32 bits", "64 bits", "128 bits"],
        "answer": 1,
        "explanation": "An IPv4 address contains 32 bits, usually written as four decimal octets.",
    },
    {
        "text": "Which protocol is used by the ping utility?",
        "options": ["FTP", "SMTP", "ICMP", "HTTP"],
        "answer": 2,
        "explanation": "Ping commonly uses ICMP Echo Request and Echo Reply messages to test reachability.",
    },
    {
        "text": "Which transport protocol is connectionless?",
        "options": ["TCP", "UDP", "Both are connection-oriented", "Neither can send data"],
        "answer": 1,
        "explanation": "UDP sends datagrams without establishing a connection first.",
    },
    {
        "text": "Which port is the default for ordinary HTTP traffic?",
        "options": ["21", "25", "53", "80"],
        "answer": 3,
        "explanation": "HTTP traditionally uses TCP port 80. HTTPS commonly uses port 443.",
    },
    {
        "text": "Which device connects different IP networks and chooses a path for packets?",
        "options": ["Hub", "Router", "Repeater", "Network adapter"],
        "answer": 1,
        "explanation": "Routers forward packets between networks using routing information.",
    },
]
