const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const app = express();

const PORT = process.env.PORT || 3000;

// --- CREDENCIALES ---
cloudinary.config({ 
  cloud_name: 'dvlbsl16g', 
  api_key: '721617469253873', 
  api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0")
  .then(() => console.log("🚀 Sistema de Torneos con Inscripciones Activo"));

const upload = multer({ storage: multer.memoryStorage() });

// --- MODELOS ---
const Config = mongoose.model('Config', { logoURL: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroTitulo: String });
// Torneo ahora incluye participantes
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] } });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-master-tourney', resave: false, saveUninitialized: false }));

const subirImg = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS DE ACCIÓN ---

app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        const nuevo = new User({ user, pass, rol });
        await nuevo.save();
        req.session.uid = nuevo._id; req.session.rol = nuevo.rol; req.session.u = nuevo.user;
        return res.redirect('/');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user; res.redirect('/'); }
    else res.send('Acceso denegado.');
});

// Lógica de Inscripción
app.post('/inscribir/:id', async (req, res) => {
    const u = await User.findById(req.session.uid);
    const t = await Torneo.findById(req.params.id);
    // Evitar duplicados
    if (!t.participantes.some(p => p.nombre === u.user)) {
        t.participantes.push({ nombre: u.user, foto: u.foto || "" });
        await t.save();
    }
    res.redirect('/');
});

app.post('/admin/nuevo-torneo', async (req, res) => {
    if (req.session.rol === 'admin') await new Torneo(req.body).save();
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    if (req.params.tipo === 'tor') await Torneo.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'nov') await Novedad.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'lib') await Libro.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/ajustes', upload.single('foto'), async (req, res) => {
    let update = { color: req.body.color };
    if (req.file) update.foto = await subirImg(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, update);
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const conf = await Config.findOne();
    const logoActual = conf ? conf.logoURL : "https://via.placeholder.com/150?text=Logo";

    if (!req.session.uid) return res.send(`
        <style>body{margin:0; font-family:sans-serif; background:#0f172a; height:100vh; display:flex; justify-content:center; align-items:center; color:white; font-family:sans-serif;} .glass{background:rgba(255,255,255,0.05); backdrop-filter:blur(15px); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:40px; width:300px; text-align:center;} input, button{width:100%; padding:12px; margin:8px 0; border-radius:10px; border:none;} button{background:#3498db; color:white; cursor:pointer; font-weight:bold;}</style>
        <div class="glass"><img src="${logoActual}" style="max-width:100px; margin-bottom:20px;"><form action="/auth" method="POST"><input name="user" placeholder="Usuario"><input name="pass" type="password" placeholder="Pass"><input name="pin" placeholder="PIN Admin (Opcional)"><button name="accion" value="login">Entrar</button><button name="accion" value="registro" style="background:none; color:#94a3b8; font-size:0.8em;">Registrarse</button></form></div>
    `);

    const u = await User.findById(req.session.uid);
    const tors = await Torneo.find().sort({ fecha: 1 });
    const novs = await Novedad.find().sort({ _id: -1 });
    const libs = await Libro.find();
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { margin:0; font-family:sans-serif; background:#0f172a; color:white; background: radial-gradient(circle at top, #1e293b, #0f172a); background-attachment: fixed; }
            .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; }
            .nav { position:fixed; top:0; width:100%; z-index:1000; padding:15px; text-align:center; background: rgba(15, 23, 42, 0.9); font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); }
            .tabs { position:fixed; top:50px; width:100%; display:flex; z-index:1000; justify-content:center; gap:5px; padding:10px 0; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); }
            .tab { padding:8px 12px; cursor:pointer; font-size:0.7em; border-radius:10px; color:#94a3b8; }
            .tab.active { background:${u.color}; color:white; }
            .container { max-width:450px; margin:130px auto 40px; padding:0 20px; }
            .card { padding:15px; margin-bottom:15px; position:relative; }
            .btn-user { position:fixed; bottom:20px; left:20px; width:50px; height:50px; border-radius:50%; z-index:2000; border:2px solid white; background:${u.color}; display:flex; justify-content:center; align-items:center; cursor:pointer; overflow:hidden; }
            .section { display:none; } .active-sec { display:block; }
            input, button { width:100%; padding:10px; margin-top:5px; border-radius:10px; border:none; }
            .p-list { display:flex; gap:5px; margin-top:10px; flex-wrap:wrap; }
            .p-chip { width:30px; height:30px; border-radius:50%; background:${u.color}; border:1px solid white; display:flex; justify-content:center; align-items:center; font-size:10px; overflow:hidden; }
        </style>
    </head>
    <body>
        <div class="nav">BIBLIOTECA MASTER</div>
        <div class="tabs">
            <div class="tab active" onclick="ver('nov', this)">NOTICIAS</div>
            <div class="tab" onclick="ver('lib', this)">LIBROS</div>
            <div class="tab" onclick="ver('tor', this)">TORNEOS</div>
        </div>

        <div class="btn-user" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:${u.color};">Crear</button></form></div>` : ''}
                
                ${tors.map(t => `
                <div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/tor/${t._id}" method="POST" style="float:right;"><button style="background:none; color:red; border:none; cursor:pointer;">×</button></form>` : ''}
                    <h3 style="margin:0; color:#f1c40f;">🏆 ${t.nombre}</h3>
                    <small>Fecha: ${t.fecha}</small>
                    
                    <div class="p-list">
                        ${t.participantes.map(p => `
                            <div class="p-chip" title="${p.nombre}">
                                ${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; object-fit:cover;">` : p.nombre[0]}
                            </div>
                        `).join('')}
                    </div>

                    <form action="/inscribir/${t._id}" method="POST">
                        <button style="background:${u.color}; margin-top:10px; font-size:0.8em;">Inscribirme</button>
                    </form>
                </div>`).join('')}
            </div>

            <div id="nov" class="section active-sec">
                ${novs.map(n => `<div class="glass card">
                    <b>${n.autor}</b><br><h3>${n.titulo}</h3><p>${n.texto}</p>
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:10px;">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${libs.map(l => `<div class="glass card"><img src="${l.portada}" style="width:50px; float:left; margin-right:10px;"><b>${l.titulo}</b></div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="glass card" style="text-align:center;">
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto"><input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color};">Guardar</button>
                    </form>
                    <a href="/salir" style="color:#ff7675; display:block; margin-top:20px; text-decoration:none;">Cerrar Sesión</a>
                </div>
            </div>
        </div>

        <script>
            function ver(id, el) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                if(el) el.classList.add('active');
            }
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Biblio Master v2.5 - Sistema de Inscripción OK'));
