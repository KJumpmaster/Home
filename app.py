from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return '<h1>S.K.Y.P.I.L.O.T. System Online</h1><p>Jumpmaster Kenneth, the hangar is ready. Stand by for data upload.</p>'

if __name__ == "__main__":
    app.run()
