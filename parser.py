#!/usr/bin/env python3

from bottle import route, run, template
import pandas as pd

@route('/')
def moin():
    results = pd.read_csv('scoreboard.csv')
    return template('{{count}}', count=len(results))

run(host='localhost', port=8014, reloader=True)
