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
  .then(() => console.log("🚀 Conectado con Torneos y Noticias"));

const upload = multer({ storage: multer.memoryStorage() });

// --- MODELOS ---
const Config = mongoose.model('Config', { logoURL: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: { type: Array, default: [] } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-master-fix', resave: false, saveUninitialized: false }));

const subirImg = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS ---
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
    else res.send('Error de login.');
});

app.post('/admin/subir-logo', upload.single('archivoPng'), async (req, res) => {
    if (req.session.rol === 'admin' && req.file) {
        const url = await subirImg(req.file.buffer);
        await Config.findOneAndUpdate({}, { logoURL: url }, { upsert: true });
    }
    res.redirect('/');
});

app.post('/admin/nuevo-torneo', async (req, res) => {
    if (req.session.rol === 'admin') await new Torneo(req.body).save();
    res.redirect('/');
});

app.post('/admin/novedad', upload.single('imagen'), async (req, res) => {
    let img = req.file ? await subirImg(req.file.buffer) : "";
    await new Novedad({ ...req.body, imagen: img, fecha: new Date().toLocaleDateString(), autor: req.session.u }).save();
    res.redirect('/');
});

app.post('/admin/nuevo-libro', upload.single('portada'), async (req, res) => {
    let img = req.file ? await subirImg(req.file.buffer) : "";
    await new Libro({ ...req.body, portada: img }).save();
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    if (req.params.tipo === 'lib') await Libro.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'nov') await Novedad.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'tor') await Torneo.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/reservar', async (req, res) => {
    await new Reserva({ ...req.body, usuario: req.session.u }).save();
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

    const glassCSS = `
        body { margin:0; font-family:sans-serif; background: #0f172a; color:white; background: radial-gradient(circle at top, #1e293b, #0f172a); background-attachment: fixed; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; }
        input, button, textarea { width:100%; padding:12px; margin:8px 0; border-radius:12px; border:none; box-sizing:border-box; outline:none; font-family:inherit; }
        input, textarea { background: rgba(255,255,255,0.1); color:white; }
        button { cursor:pointer; font-weight:bold; }
        .section { display:none; animation: fadeIn 0.3s; } .active-sec { display:block; }
        @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
    `;

    if (!req.session.uid) return res.send(`
        <style>${glassCSS} body { height:100vh; display:flex; justify-content:center; align-items:center; }</style>
        <div class="glass" style="padding:40px; width:300px; text-align:center;">
            <img src="${logoActual}" style="max-width:100px; margin-bottom:20px;">
            <form action="/auth" method="POST">
                <input name="user" placeholder="Usuario" required>
                <input name="pass" type="password" placeholder="Pass" required>
                <input name="pin" placeholder="PIN Admin (Opcional)">
                <button name="accion" value="login" style="background:#3498db; color:white;">Entrar</button>
                <button name="accion" value="registro" style="background:none; color:#94a3b8; font-size:0.8em;">Registrarse</button>
            </form>
        </div>
    `);

    const u = await User.findById(req.session.uid);
    const novs = await Novedad.find().sort({ _id: -1 });
    const libs = await Libro.find();
    const tors = await Torneo.find().sort({ fecha: 1 });
    const ress = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            ${glassCSS}
            #splash { position:fixed; top:0; left:0; width:100%; height:100%; background:#0f172a; z-index:3000; display:flex; justify-content:center; align-items:center; animation: fadeOut 1s forwards 1.5s; }
            @keyframes fadeOut { to { opacity:0; visibility:hidden; } }
            .nav { position:fixed; top:0; width:100%; z-index:1000; padding:15px; text-align:center; background: rgba(15, 23, 42, 0.9); font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); }
            .tabs { position:fixed; top:50px; width:100%; display:flex; z-index:1000; justify-content:center; gap:5px; padding:10px 0; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); }
            .tab { padding:8px 12px; cursor:pointer; font-size:0.7em; border-radius:10px; color:#94a3b8; }
            .tab.active { background:${u.color}; color:white; }
            .container { max-width:450px; margin:130px auto 40px; padding:0 20px; }
            .card { padding:15px; margin-bottom:15px; position:relative; }
            .btn-user { position:fixed; bottom:20px; left:20px; width:50px; height:50px; border-radius:50%; z-index:2000; border:2px solid white; overflow:hidden; background:${u.color}; display:flex; justify-content:center; align-items:center; cursor:pointer; }
            .del { color:#ff7675; float:right; background:none; border:none; cursor:pointer; font-weight:bold; }
        </style>
    </head>
    <body>
        <div id="splash"><img src="${logoActual}" style="max-width:120px; animation: pulse 1.5s infinite;"></div>
        <style>@keyframes pulse { 50% {transform:scale(1.1);} }</style>

        <div class="nav">BIBLIOTECA MASTER</div>
        
        <div class="tabs">
            <div class="tab active" onclick="ver('nov', this)">NOTICIAS</div>
            <div class="tab" onclick="ver('lib', this)">LIBROS</div>
            <div class="tab" onclick="ver('pre', this)">PRÉSTAMOS</div>
            <div class="tab" onclick="ver('tor', this)">TORNEOS</div>
        </div>

        <div class="btn-user" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Noticia</b><form action="/admin/novedad" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><textarea name="texto" placeholder="Mensaje"></textarea><input type="file" name="imagen"><button style="background:${u.color};">Publicar</button></form></div>` : ''}
                ${novs.map(n => `<div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/nov/${n._id}" method="POST" style="float:right;"><button class="del">×</button></form>` : ''}
                    <b style="color:${u.color}">${n.autor}</b><br>
                    <h3 style="margin:5px 0;">${n.titulo}</h3>
                    <p style="opacity:0.8; font-size:0.9em;">${n.texto}</p>
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:10px; margin-top:10px;">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Nuevo Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada"><button style="background:${u.color};">Añadir</button></form></div>` : ''}
                ${libs.map(l => `<div class="glass card">
                    <img src="${l.portada}" style="width:50px; height:70px; float:left; margin-right:12px; border-radius:5px; object-fit:cover;">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/lib/${l._id}" method="POST"><button class="del">×</button></form>` : ''}
                    <b>${l.titulo}</b><br><small>${l.autor}</small>
                    <form action="/reservar" method="POST" style="clear:both; padding-top:10px;">
                        <input type="hidden" name="libroId" value="${l._id}"><input type="hidden" name="libroTitulo" value="${l.titulo}">
                        <input name="curso" placeholder="Curso" required style="width:60%;">
                        <button style="background:#2ecc71; width:35%;">Pedir</button>
                    </form>
                </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${ress.map(r => `<div class="glass card"><b>${r.libroTitulo}</b><br><small>Para: ${r.usuario} (${r.curso})</small></div>`).join('')}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre Torneo"><input type="date" name="fecha"><button style="background:#f1c40f; color:black;">Crear Torneo</button></form></div>` : ''}
                ${tors.map(t => `<div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/tor/${t._id}" method="POST" style="float:right;"><button class="del">×</button></form>` : ''}
                    🏆 <b style="color:#f1c40f;">${t.nombre}</b><br><small>Fecha: ${t.fecha}</small>
                </div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="glass card" style="text-align:center;">
                    <div style="width:70px; height:70px; background:${u.color}; border-radius:50%; margin:0 auto 10px; border:2px solid white; display:flex; justify-content:center; align-items:center; overflow:hidden;">${avatar}</div>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto"><input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color}; color:white;">Guardar</button>
                    </form>
                    ${req.session.rol === 'admin' ? `<div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                        <b style="color:#f1c40f;">Logo PNG Inicio</b>
                        <form action="/admin/subir-logo" method="POST" enctype="multipart/form-data">
                            <input type="file" name="archivoPng" accept="image/png" required><button style="background:#f1c40f; color:black;">Subir Logo Inicio</button>
                        </form>
                    </div>` : ''}
                    <a href="/salir" style="color:#ff7675; text-decoration:none; display:block; margin-top:20px;">Salir</a>
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

app.listen(PORT, () => console.log('Biblio Master v2.2 - Torneos Fix'));
