#!/usr/bin/env python3

from bottle import route, run, template
import pandas, argparse

args = argparse.ArgumentParser(description='moin')
args.add_argument('--path', required=True)
args.add_argument('--port', required=True)
args = args.parse_args()

@route('/')
def moin():
    results = pandas.read_csv(args.path + "/scoreboard.csv")
    return template("{{count}}", count=len(results))

run(host="localhost", port=args.port, reloader=True)
