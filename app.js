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
    limits: { fileSize: 2 * 1024 * 1024 }, // Máximo 2MB para no saturar
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes'));
    }
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Sistema Reiniciado y Estable"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: { type: Array, default: [] } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] } });
const User = mongoose.model('User', { 
    user: String, pass: String, rol: String, 
    color: { type: String, default: '#2c3e50' }, 
    foto: { type: String, default: "" },
    carnet: { nombre: String, apellidos: String, curso: String, activo: { type: Boolean, default: false } }
});

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'reboot-2026', resave: false, saveUninitialized: false }));

// --- LOGICA DE SUBIDA ---
const subirFoto = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send('Registrado. <a href="/">Login</a>');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.uid = u._id; req.session.rol = u.rol; res.redirect('/'); }
    else res.send('Error.');
});

app.post('/ajustes', upload.single('foto'), async (req, res) => {
    let update = { color: req.body.color };
    if (req.file) update.foto = await subirFoto(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, update);
    res.redirect('/');
});

app.post('/devolver/:id', async (req, res) => {
    const { libroId, estrellas, comentario } = req.body;
    if (estrellas) {
        await Libro.findByIdAndUpdate(libroId, { 
            $push: { reseñas: { user: req.session.uid, pts: estrellas, txt: comentario, fecha: new Date().toLocaleDateString() } } 
        });
    }
    await Reserva.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

// Torneos y Libros (Admin)
app.post('/admin/:task', upload.single('portada'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    if (req.params.task === 'nuevo-libro') {
        let img = req.file ? await subirFoto(req.file.buffer) : "";
        await new Libro({ ...req.body, portada: img }).save();
    }
    if (req.params.task === 'nuevo-torneo') await new Torneo(req.body).save();
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    if (!req.session.uid) return res.send(`<body><form action="/auth" method="POST"><h2>Acceso</h2><input name="user" placeholder="User"><input name="pass" type="password"><input name="pin" placeholder="PIN Admin"><button name="accion" value="login">Entrar</button><button name="accion" value="registro">Crear Cuenta</button></form></body>`);

    const u = await User.findById(req.session.uid);
    const libros = await Libro.find();
    const misPrestamos = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const torneos = await Torneo.find();

    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family:sans-serif; background:#f4f7f6; margin:0; padding-bottom:70px; }
            .nav { background:${u.color}; color:white; padding:15px; text-align:center; position:sticky; top:0; z-index:100; }
            .tabs { display:flex; background:white; position:sticky; top:46px; z-index:90; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
            .tab { flex:1; padding:12px; text-align:center; cursor:pointer; font-weight:bold; color:#888; }
            .tab.active { color:${u.color}; border-bottom:3px solid ${u.color}; }
            .container { max-width:500px; margin:80px auto 20px; padding:0 15px; }
            .card { background:white; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden; }
            input, select, textarea, button { width:100%; padding:10px; margin-top:8px; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; }
            .btn-user { position:fixed; bottom:20px; left:20px; width:60px; height:60px; background:${u.color}; border-radius:50%; border:3px solid white; color:white; display:flex; justify-content:center; align-items:center; font-size:22px; cursor:pointer; z-index:110; overflow:hidden; }
            .section { display:none; } .active-sec { display:block; }
            .portada { width:65px; height:90px; float:left; margin-right:12px; border-radius:4px; object-fit:cover; }
        </style>
    </head>
    <body>
        <div class="nav"><b>BIBLIOTECA MASTER</b></div>
        <div class="tabs">
            <div class="tab active" id="t-lib" onclick="switchTab('lib')">Libros</div>
            <div class="tab" id="t-pre" onclick="switchTab('pre')">Préstamos</div>
            <div class="tab" id="t-tor" onclick="switchTab('tor')">Torneos</div>
        </div>

        <div class="btn-user" onclick="switchTab('adj')">${avatar}</div>

        <div class="container">
            <div id="lib" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="card"><b>Nuevo Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada" accept="image/*"><button style="background:${u.color}; color:white;">Añadir</button></form></div>` : ''}
                ${libros.map(l => `
                    <div class="card">
                        <img src="${l.portada || 'https://via.placeholder.com/65x90'}" class="portada">
                        <b>${l.titulo}</b><br><small>${l.autor}</small>
                        <form action="/reservar" method="POST" style="clear:both; padding-top:10px;">
                            <input type="hidden" name="libroId" value="${l._id}">
                            <input type="hidden" name="libroTitulo" value="${l.titulo}">
                            <input name="curso" placeholder="Tu curso" required style="width:65%;">
                            <button style="width:30%; background:#2ecc71; color:white; border:none;">Pedir</button>
                        </form>
                        <details style="margin-top:8px;"><summary style="font-size:0.8em; color:#888; cursor:pointer;">Reseñas (${l.reseñas.length})</summary>
                            ${l.reseñas.map(r => `<div style="font-size:0.8em; border-bottom:1px solid #eee; padding:5px;">${"⭐".repeat(r.pts)}<br>${r.txt}</div>`).join('')}
                        </details>
                    </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${misPrestamos.map(p => `
                    <div class="card">
                        <b>${p.libroTitulo}</b><br><small>Para: ${p.usuario}</small>
                        <form action="/devolver/${p._id}" method="POST">
                            <input type="hidden" name="libroId" value="${p.libroId}">
                            <select name="estrellas"><option value="">Valorar...</option><option value="5">⭐⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="1">⭐</option></select>
                            <textarea name="comentario" placeholder="Comentario opcional..."></textarea>
                            <button style="background:#e74c3c; color:white; border:none;">Devolver</button>
                        </form>
                    </div>`).join('')}
                ${misPrestamos.length === 0 ? '<p style="text-align:center;">No tienes libros pendientes.</p>' : ''}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card"><b>Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:${u.color}; color:white;">Crear</button></form></div>` : ''}
                ${torneos.map(t => `<div class="card">🏆 <b>${t.nombre}</b><br><small>Fecha: ${t.fecha}</small></div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="card" style="text-align:center;">
                    <div style="width:80px; height:80px; background:${u.color}; border-radius:50%; margin:0 auto 10px; display:flex; justify-content:center; align-items:center; color:white; font-size:30px; border:4px solid #eee; overflow:hidden;">${avatar}</div>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto" accept="image/*">
                        <input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color}; color:white;">Guardar Perfil</button>
                    </form>
                    <hr>
                    <a href="/salir" style="color:red; text-decoration:none; font-weight:bold;">Cerrar Sesión</a>
                </div>
            </div>
        </div>

        <script>
            function switchTab(id) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                const tab = document.getElementById('t-' + id);
                if(tab) tab.classList.add('active');
            }
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Servidor en marcha'));
