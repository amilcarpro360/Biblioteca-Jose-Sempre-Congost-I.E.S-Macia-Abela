const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const app = express();

const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN ---
cloudinary.config({ 
  cloud_name: 'dvlbsl16g', 
  api_key: '721617469253873', 
  api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') ? cb(null, true) : cb(null, false);
    }
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Base de Datos OK"));

// --- MODELOS UNIFICADOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: Array });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: Array });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#2c3e50' }, foto: String, datosCarnet: Object });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-mega-fix', resave: false, saveUninitialized: false }));

// --- HELPERS ---
const subirANube = (buffer) => new Promise((resolve) => {
    let s = cloudinary.uploader.upload_stream({ folder: "biblio" }, (e, r) => resolve(r));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS DE ACCESO ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol, foto: "" }).save();
        return res.send('Cuenta creada. <a href="/">Entrar</a>');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.u = u.user; req.session.rol = u.rol; res.redirect('/'); }
    else res.send('Datos incorrectos.');
});

// --- RUTAS DE GESTIÓN ---
app.post('/add-libro', upload.single('portada'), async (req, res) => {
    let img = "https://via.placeholder.com/150";
    if (req.file) { const r = await subirANube(req.file.buffer); img = r.secure_url; }
    await new Libro({ ...req.body, portada: img, reseñas: [] }).save();
    res.redirect('/');
});

app.post('/reservar', async (req, res) => {
    await new Reserva({ ...req.body, usuario: req.session.u }).save();
    res.redirect('/');
});

app.post('/devolver/:id', async (req, res) => {
    const { estrellas, comentario, libroId } = req.body;
    if (estrellas) {
        await Libro.findByIdAndUpdate(libroId, { 
            $push: { reseñas: { usuario: req.session.u, puntos: estrellas, texto: comentario || "" } } 
        });
    }
    await Reserva.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/solicitar-carnet', async (req, res) => {
    await User.findOneAndUpdate({ user: req.session.u }, { datosCarnet: req.body });
    res.redirect('/');
});

app.post('/ajustes', upload.single('foto'), async (req, res) => {
    let data = { color: req.body.color };
    if (req.file) { const r = await subirANube(req.file.buffer); data.foto = r.secure_url; }
    await User.findOneAndUpdate({ user: req.session.u }, data);
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    if (!req.session.u) return res.send(`<body style="font-family:sans-serif; background:#2c3e50; color:white; display:flex; justify-content:center; align-items:center; height:100vh;"><form action="/auth" method="POST" style="background:white; color:black; padding:20px; border-radius:10px;"><input name="user" placeholder="Usuario" required><br><input name="pass" type="password" placeholder="Pass" required><br><input name="pin" placeholder="PIN Admin"><br><button name="accion" value="login">Entrar</button><button name="accion" value="registro">Registrar</button></form></body>`);

    const u = await User.findOne({ user: req.session.u });
    const libros = await Libro.find();
    const misReservas = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family:sans-serif; background:#f0f2f5; margin:0; padding-bottom:80px; }
            .header { background:${u.color}; color:white; padding:15px; text-align:center; position:sticky; top:0; z-index:90; }
            .card { background:white; margin:15px; padding:15px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
            .tab-bar { display:flex; background:white; position:fixed; top:50px; width:100%; z-index:80; border-bottom:1px solid #ddd; }
            .tab { flex:1; padding:15px; text-align:center; cursor:pointer; }
            .avatar-btn { position:fixed; bottom:20px; left:20px; width:60px; height:60px; background:${u.color}; border-radius:50%; color:white; display:flex; justify-content:center; align-items:center; font-size:24px; border:3px solid white; overflow:hidden; cursor:pointer; z-index:100; }
            .portada { width:60px; height:80px; float:left; margin-right:10px; border-radius:5px; }
            input, select, textarea, button { width:100%; padding:10px; margin:5px 0; border-radius:5px; border:1px solid #ddd; }
            .section { display:none; margin-top:100px; } .active { display:block; }
            .carnet { width:300px; height:180px; background:${u.color}; color:white; border-radius:15px; padding:15px; margin:0 auto; }
        </style>
    </head>
    <body>
        <div class="header"><b>BIBLIOTECA SEGURA</b></div>
        <div class="tab-bar">
            <div class="tab" onclick="ver('libros')">📚</div>
            <div class="tab" onclick="ver('prestamos')">🤝</div>
            <div class="tab" onclick="ver('carnet')">🪪</div>
        </div>

        <div class="avatar-btn" onclick="ver('ajustes')">${avatar}</div>

        <div class="container">
            <div id="sec-libros" class="section active">
                ${req.session.rol === 'admin' ? `<div class="card"><b>Añadir Libro</b><form action="/add-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada" accept="image/*"><button>Subir</button></form></div>` : ''}
                ${libros.map(l => `
                    <div class="card">
                        <img src="${l.portada}" class="portada">
                        <b>${l.titulo}</b><br><small>${l.autor}</small>
                        <form action="/reservar" method="POST" style="clear:both; margin-top:10px;">
                            <input type="hidden" name="libroId" value="${l._id}">
                            <input type="hidden" name="libroTitulo" value="${l.titulo}">
                            <input name="curso" placeholder="Curso" required style="width:60%">
                            <button style="width:35%; background:#2ecc71; color:white;">Pedir</button>
                        </form>
                        <details><summary>Ver Reseñas (${l.reseñas.length})</summary>
                            ${l.reseñas.map(r => `<div style="font-size:0.8em; background:#f9f9f9; padding:5px; margin:2px;"><b>${r.usuario}:</b> ${"⭐".repeat(r.puntos)}<br>${r.texto}</div>`).join('')}
                        </details>
                    </div>`).join('')}
            </div>

            <div id="sec-prestamos" class="section">
                ${misReservas.map(r => `
                    <div class="card">
                        <b>${r.libroTitulo}</b><br><small>Prestado a: ${r.usuario}</small>
                        <form action="/devolver/${r._id}" method="POST">
                            <input type="hidden" name="libroId" value="${r.libroId}">
                            <select name="estrellas"><option value="">Puntuar...</option><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option></select>
                            <textarea name="comentario" placeholder="Tu reseña..."></textarea>
                            <button style="background:#e74c3c; color:white;">Devolver</button>
                        </form>
                    </div>`).join('')}
            </div>

            <div id="sec-carnet" class="section">
                <div class="card">
                    <b>Solicitar Carnet</b>
                    <form action="/solicitar-carnet" method="POST">
                        <input name="nombre" placeholder="Nombre" required>
                        <input name="apellidos" placeholder="Apellidos" required>
                        <input name="curso" placeholder="Curso" required>
                        <button>Guardar Datos</button>
                    </form>
                </div>
                ${u.datosCarnet ? `
                    <div class="carnet">
                        <div style="width:60px; height:60px; background:white; float:left; margin-right:10px; border-radius:5px; overflow:hidden;">${avatar}</div>
                        <b>${u.datosCarnet.nombre}</b><br>${u.datosCarnet.apellidos}<br><small>Curso: ${u.datosCarnet.curso}</small>
                        <div style="margin-top:40px; border-top:1px solid white; font-size:0.7em;">BIBLIOTECA OFICIAL</div>
                    </div>` : ''}
            </div>

            <div id="sec-ajustes" class="section">
                <div class="card" style="text-align:center;">
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto" accept="image/*">
                        <input type="color" name="color" value="${u.color}">
                        <button>Guardar Ajustes</button>
                    </form>
                    <a href="/salir" style="color:red;">Cerrar Sesión</a>
                </div>
            </div>
        </div>

        <script>
            function ver(id) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                document.getElementById('sec-' + id).classList.add('active');
            }
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Servidor arreglado y estable'));

