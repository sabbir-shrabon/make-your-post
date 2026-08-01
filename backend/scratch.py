import urllib.request
import json
url = "https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json"
req = urllib.request.urlopen(url)
data = json.loads(req.read())
print(len(data), data[0])
