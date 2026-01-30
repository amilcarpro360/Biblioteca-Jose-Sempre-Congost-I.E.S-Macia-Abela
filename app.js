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
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') ? cb(null, true) : cb(null, false);
    }
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Interfaz Glassmorphism Lista"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: { type: Array, default: [] } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] } });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String });
const User = mongoose.model('User', { 
    user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, 
    foto: { type: String, default: "" }
});

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'glass-biblio-2026', resave: false, saveUninitialized: false }));

// --- HELPERS ---
const subirImagen = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS (Lógica interna se mantiene igual para que no rompa nada) ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send('<body style="background:#000;color:white;text-align:center;padding-top:50px;font-family:sans-serif;"><h2>✅ Registro con éxito</h2><a href="/" style="color:#3498db;">Volver al Login</a></body>');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user; res.redirect('/'); }
    else res.send('Error de acceso.');
});

// (Rutas de /admin/nuevo-libro, /admin/novedad, /reservar, /devolver, /ajustes se mantienen igual)
app.post('/admin/nuevo-libro', upload.single('portada'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImagen(req.file.buffer) : "";
    await new Libro({ ...req.body, portada: img }).save();
    res.redirect('/');
});
app.post('/admin/novedad', upload.single('imagen'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImagen(req.file.buffer) : "";
    await new Novedad({ ...req.body, imagen: img, fecha: new Date().toLocaleDateString() }).save();
    res.redirect('/');
});
app.post('/admin/nuevo-torneo', async (req, res) => {
    if (req.session.rol === 'admin') await new Torneo(req.body).save();
    res.redirect('/');
});
app.post('/reservar', async (req, res) => {
    await new Reserva({ ...req.body, usuario: req.session.u }).save();
    res.redirect('/');
});
app.post('/devolver/:id', async (req, res) => {
    const { libroId, estrellas, comentario } = req.body;
    if (estrellas) await Libro.findByIdAndUpdate(libroId, { $push: { reseñas: { usuario: req.session.u, puntos: estrellas, texto: comentario, fecha: new Date().toLocaleDateString() } } });
    await Reserva.findByIdAndDelete(req.params.id);
    res.redirect('/');
});
app.post('/ajustes', upload.single('foto'), async (req, res) => {
    let update = { color: req.body.color };
    if (req.file) update.foto = await subirFoto(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, update);
    res.redirect('/');
});
app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const loginStyle = `
        body { margin:0; font-family:sans-serif; background: linear-gradient(135deg, #1e2a38, #000); background-attachment: fixed; color:white; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        input, select, textarea { width:100%; padding:12px; margin:8px 0; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:white; outline:none; box-sizing:border-box; }
        button { width:100%; padding:12px; border-radius:10px; border:none; background:#3498db; color:white; font-weight:bold; cursor:pointer; }
    `;

    if (!req.session.uid) return res.send(`
    <style>${loginStyle} body { height:100vh; display:flex; justify-content:center; align-items:center; }</style>
    <div class="glass" style="padding:40px; width:300px; text-align:center;">
        <img src="TU_LOGO_AQUI" style="width:70px; margin-bottom:20px;">
        <h2 style="margin:0 0 20px;">Biblio App</h2>
        <form action="/auth" method="POST">
            <input name="user" placeholder="Usuario" required>
            <input name="pass" type="password" placeholder="Contraseña" required>
            <input name="pin" placeholder="PIN Admin">
            <button name="accion" value="login">Iniciar Sesión</button>
            <button name="accion" value="registro" style="background:none; color:#888; font-size:0.8em; margin-top:15px;">Crear una cuenta nueva</button>
        </form>
    </div>`);

    const u = await User.findById(req.session.uid);
    const libros = await Libro.find();
    const misReservas = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const novedades = await Novedad.find().sort({ _id: -1 });
    const torneos = await Torneo.find();
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            ${loginStyle}
            #splash { position:fixed; top:0; left:0; width:100%; height:100%; background:#121212; z-index:2000; display:flex; justify-content:center; align-items:center; animation: fadeOut 1s forwards 1.5s; }
            @keyframes fadeOut { to { opacity:0; visibility:hidden; } }
            
            .nav { position:fixed; top:0; width:100%; z-index:1000; padding:15px; box-sizing:border-box; text-align:center; font-weight:bold; }
            .tabs { position:fixed; top:50px; width:100%; display:flex; z-index:1000; justify-content:center; padding:10px 0; }
            .tab { padding:10px 15px; margin:0 5px; cursor:pointer; font-size:0.8em; opacity:0.6; transition:0.3s; }
            .tab.active { opacity:1; background:rgba(255,255,255,0.15); border-radius:12px; }
            
            .container { max-width:450px; margin:110px auto 30px; padding:0 20px; }
            .card { padding:20px; margin-bottom:20px; }
            .btn-user { position:fixed; bottom:25px; left:25px; width:55px; height:55px; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:1500; font-size:20px; border:2px solid rgba(255,255,255,0.3); overflow:hidden; background:${u.color}; }
            .section { display:none; } .active-sec { display:block; }
            .portada { width:65px; height:90px; border-radius:8px; float:left; margin-right:15px; object-fit:cover; }
        </style>
    </head>
    <body>
        <div id="splash"><img src="TU_LOGO_AQUI" style="width:120px; animation: pulse 1s infinite;"></div>
        <style>@keyframes pulse { 50%{transform:scale(1.1); opacity:0.7;} }</style>

        <div class="nav glass" style="border-radius:0 0 20px 20px; background:${u.color}55;">BIBLIOTECA MASTER</div>
        
        <div class="tabs">
            <div class="tab glass active" onclick="ver('nov', this)">📢 Novs</div>
            <div class="tab glass" onclick="ver('lib', this)">📚 Libros</div>
            <div class="tab glass" onclick="ver('pre', this)">🤝 Prest</div>
            <div class="tab glass" onclick="ver('tor', this)">🏆 Torneos</div>
        </div>

        <div class="btn-user" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Novedad</b><form action="/admin/novedad" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><textarea name="texto" placeholder="Mensaje..."></textarea><input type="file" name="imagen" accept="image/*"><button style="background:${u.color};">Publicar</button></form></div>` : ''}
                ${novedades.map(n => `<div class="card glass">${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:12px; margin-bottom:15px;">`:''}<h3>${n.titulo}</h3><p style="opacity:0.8; font-size:0.9em;">${n.texto}</p><small style="opacity:0.5;">${n.fecha}</small></div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada" accept="image/*"><button style="background:${u.color};">Añadir</button></form></div>` : ''}
                ${libros.map(l => `
                    <div class="card glass">
                        <img src="${l.portada}" class="portada">
                        <b>${l.titulo}</b><br><small style="opacity:0.7;">${l.autor}</small>
                        <form action="/reservar" method="POST" style="clear:both; padding-top:15px;">
                            <input type="hidden" name="libroId" value="${l._id}"><input type="hidden" name="libroTitulo" value="${l.titulo}">
                            <input name="curso" placeholder="Tu curso" required style="width:60%; display:inline-block;">
                            <button style="width:35%; background:#2ecc71; display:inline-block;">Pedir</button>
                        </form>
                        <details style="margin-top:10px;"><summary style="font-size:0.8em; opacity:0.6; cursor:pointer;">Reseñas (${l.reseñas.length})</summary>
                            ${l.reseñas.map(r => `<div style="font-size:0.8em; background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; margin-top:5px;"><b>${r.usuario}:</b> ${"⭐".repeat(r.puntos)}<br>${r.texto}</div>`).join('')}
                        </details>
                    </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${misReservas.map(r => `
                    <div class="card glass">
                        <b>${r.libroTitulo}</b><br><small style="opacity:0.7;">Prestado a: ${r.usuario}</small>
                        <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                            <input type="hidden" name="libroId" value="${r.libroId}">
                            <select name="estrellas"><option value="">Puntuar...</option><option value="5">⭐⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="1">⭐</option></select>
                            <textarea name="comentario" placeholder="Comentario opcional..."></textarea>
                            <button style="background:#e74c3c;">Devolver</button>
                        </form>
                    </div>`).join('')}
                ${misReservas.length === 0 ? '<p style="text-align:center; opacity:0.5;">No tienes libros ahora.</p>' : ''}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:${u.color};">Crear</button></form></div>` : ''}
                ${torneos.map(t => `<div class="card glass">🏆 <b>${t.nombre}</b><br><small style="opacity:0.7;">${t.fecha}</small></div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="card glass" style="text-align:center;">
                    <div style="width:85px; height:85px; background:${u.color}; border-radius:50%; margin:0 auto 15px; display:flex; justify-content:center; align-items:center; font-size:32px; border:3px solid white; overflow:hidden;">${avatar}</div>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto" accept="image/*">
                        <input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color};">Guardar Cambios</button>
                    </form>
                    <a href="/salir" style="color:#ff7675; text-decoration:none; display:inline-block; margin-top:15px; font-weight:bold;">Cerrar Sesión</a>
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

app.listen(PORT, () => console.log('Interfaz Glassmorphism Funcionando'));
