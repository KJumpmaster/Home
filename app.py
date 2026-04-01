from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return """
    <body style="background-color:#1a1a1a; color:#00ff00; font-family:monospace; padding:50px;">
        <h1>>> S.K.Y.P.I.L.O.T. STRATEGIC DASHBOARD</h1>
        <hr>
        <h3>CURRENT AO: [NORWAY - AIR REALISTIC]</h3>
        <p>PRIMARY TARGET: HARBOR DESTROYERS</p>
        <p>AIRCRAFT: F-5A(G) FREEDOM FIGHTER</p>
        <br>
        <div style="border:1px solid #00ff00; padding:20px; width:300px;">
            <h4>BALLISTICS DATA (NORDEN II)</h4>
            <p>RELEASE ALT: 3000m</p>
            <p>DIVE ANGLE: 30&deg;</p>
            <p>EST. IMPACT: GRID E-4</p>
        </div>
        <br>
        <p style="color:#ff0000;">** JUMPMASTER KENNETH: MISSION STATUS - READY **</p>
    </body>
    """

if __name__ == "__main__":
    app.run()
    
