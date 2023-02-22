#!/usr/bin/env python3

import argparse, sys, os, time

from twisted.words.protocols import irc
from twisted.internet import reactor, protocol, ssl

args = argparse.ArgumentParser(description='moin')
args.add_argument('--path', required=True)
args = args.parse_args()

class Bot(object):

    def __init__(self, nickname, channel, server, port):
        self.nickname = nickname
        self.channel = channel
        self.server = server
        self.port = port

BOTS = [
    Bot("moin", "#hsmr-moin", "irc.hackint.org", 6697)
]

LOGPATH = args.path + "/scoreboard.csv"

VARIATIONS = [
    "moin",
    "oi",
    "noim",
    "niom",
    "mion",
]

class IRCLogger(object):

    def __init__(self, server, channel):
        self._channel = channel
        self._server = server
        self.file = open(LOGPATH, "a",
                         encoding="utf-8", errors="replace")

    def log(self, message):
        self.file.close()
        self.file = open(LOGPATH, "a",
                         encoding="utf-8", errors="replace")
        self.file.write('%s,%s\n' % (
            time.time(), message)
        )
        self.file.flush()

    def close(self):
        self.file.close()

    def message(self, user, message, channel): 
        if message.lower() in VARIATIONS.lower():
            self.log("<%s>,%s,%s" % (user, message, channel))

class IRCBot(irc.IRCClient):

    def __init__(self, factory, nickname, channel, logger):
        self.lineRate = 2
        self.factory = factory
        self.nickname = nickname
        self._channel = channel
        self._logger = logger

    def irc_unknown(self, prefix, command, params):
        if command == "ERR_UNAVAILRESOURCE":
            self.irc_ERR_NICKNAMEINUSE(prefix, params)

    def connectionMade(self):
        self.factory.resetDelay()
        irc.IRCClient.connectionMade(self)

    def signedOn(self):
        self.join(self._channel)

    def privmsg(self, user, channel, msg):
        self._logger.message(user, msg, channel)

class IRCBotFactory(protocol.ReconnectingClientFactory):

    def __init__(self, bot):
        self._bot = bot

    def buildProtocol(self, addr):
        bot = self._bot
        logger = IRCLogger(bot.server, bot.channel)
        return IRCBot(self, bot.nickname, bot.channel, logger)


def setup():
    for bot in BOTS:
        factory = IRCBotFactory(bot)
        reactor.connectSSL(bot.server, bot.port, factory, ssl.ClientContextFactory())


def main(argv):
    assert sys.version_info[0] == 3
    setup()
    reactor.run()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
