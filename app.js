const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG CLOUDINARY ---
cloudinary.config({ 
    cloud_name: 'dvlbsl16g', 
    api_key: '721617469253873', 
    api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});

// --- CONEXIÓN MONGODB ---
mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/BiblioMasterUltra")
    .then(() => console.log("🏆 SISTEMA ULTRA-ESTABLE CONECTADO"));

// --- MODELOS ---
const Config = mongoose.model('Config', { logoURL: String, splashURL: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#6366f1' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: { type: Date, default: Date.now }, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, disponible: { type: Boolean, default: true } });
const Actividad = mongoose.model('Actividad', { nombre: String, desc: String, fecha: String, hora: String, imagen: String, asistentes: { type: Array, default: [] }, cupos: Number });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroTitulo: String, fecha: { type: Date, default: Date.now } });

// --- FILTRO DE SEGURIDAD PARA IMÁGENES ---
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('¡Solo se permiten imágenes!'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // Máximo 5MB
});

// Helper para subir a Cloudinary
const subirImg = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblio_ultra" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'ultra-secret-2026', resave: false, saveUninitialized: false }));

// --- RUTAS ---

app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        const u = new User({ user, pass, rol });
        await u.save();
        req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user;
    } else {
        const u = await User.findOne({ user, pass });
        if (u) { req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user; }
    }
    res.redirect('/');
});

// Acciones Admin (Noticias, Libros, Actividades, Logos)
app.post('/admin/add/:tipo', upload.single('file'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let url = req.file ? await subirImg(req.file.buffer) : "";
    
    if (req.params.tipo === 'nov') await new Novedad({ ...req.body, imagen: url, autor: req.session.u }).save();
    if (req.params.tipo === 'lib') await new Libro({ ...req.body, portada: url }).save();
    if (req.params.tipo === 'act') await new Actividad({ ...req.body, imagen: url }).save();
    if (req.params.tipo === 'splash') await Config.findOneAndUpdate({}, { splashURL: url }, { upsert: true });
    if (req.params.tipo === 'logo') await Config.findOneAndUpdate({}, { logoURL: url }, { upsert: true });
    
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    const { tipo, id } = req.params;
    if (tipo === 'lib') await Libro.findByIdAndDelete(id);
    if (tipo === 'nov') await Novedad.findByIdAndDelete(id);
    if (tipo === 'act') await Actividad.findByIdAndDelete(id);
    if (tipo === 'pre') {
        const r = await Reserva.findByIdAndDelete(id);
        if (r) await Libro.findOneAndUpdate({ titulo: r.libroTitulo }, { disponible: true });
    }
    res.redirect('/');
});

app.post('/user/inscribir/:id', async (req, res) => {
    const act = await Actividad.findById(req.params.id);
    const u = await User.findById(req.session.uid);
    if (act.asistentes.length < act.cupos && !act.asistentes.some(a => a.nombre === u.user)) {
        act.asistentes.push({ nombre: u.user, foto: u.foto || "" });
        await act.save();
    }
    res.redirect('/');
});

app.post('/user/reservar', async (req, res) => {
    const l = await Libro.findOne({ titulo: req.body.libroTitulo, disponible: true });
    if (l) {
        await new Reserva({ ...req.body, usuario: req.session.u }).save();
        l.disponible = false; await l.save();
    }
    res.redirect('/');
});

app.post('/user/config', upload.single('foto'), async (req, res) => {
    let up = { color: req.body.color };
    if (req.file) up.foto = await subirImg(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, up);
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const [u, conf, novs, libs, acts, ress] = await Promise.all([
        req.session.uid ? User.findById(req.session.uid) : null,
        Config.findOne(),
        Novedad.find().sort({ fecha: -1 }),
        Libro.find().sort({ titulo: 1 }),
        Actividad.find().sort({ fecha: 1 }),
        Reserva.find()
    ]);

    const logo = conf?.logoURL || "https://cdn-icons-png.flaticon.com/512/2232/2232688.png";
    const splash = conf?.splashURL || logo;
    const accent = u?.color || "#6366f1";

    // CSS Avanzado
    const css = `
        :root { --accent: ${accent}; }
        body { margin:0; font-family:'Segoe UI', sans-serif; background:#0f172a; color:white; overflow-x:hidden; }
        .splash { position:fixed; top:0; left:0; width:100%; height:100vh; background:#0f172a; z-index:5000; display:flex; flex-direction:column; align-items:center; justify-content:center; animation: fadeSplash 2s forwards 1.5s; }
        @keyframes fadeSplash { to { opacity:0; visibility:hidden; } }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 20px; margin-bottom: 20px; transition: 0.3s; }
        .nav-top { position:fixed; top:0; width:100%; height:60px; background:rgba(15,23,42,0.9); display:flex; align-items:center; justify-content:center; z-index:1000; border-bottom:1px solid rgba(255,255,255,0.05); }
        .tabs { position:fixed; top:60px; width:100%; display:flex; overflow-x:auto; background:rgba(15,23,42,0.8); z-index:999; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .tab { padding:8px 18px; cursor:pointer; font-size:12px; font-weight:bold; color:#64748b; white-space:nowrap; }
        .tab.active { color:white; border-bottom:3px solid var(--accent); }
        .container { max-width:480px; margin:140px auto 40px; padding:0 20px; }
        .section { display:none; animation: fadeIn 0.4s ease; } .active-sec { display:block; }
        @keyframes fadeIn { from {opacity:0; transform:scale(0.98);} to {opacity:1; transform:scale(1);} }
        input, textarea, button { width:100%; padding:14px; margin:8px 0; border-radius:15px; border:none; box-sizing:border-box; outline:none; }
        input, textarea { background: rgba(255,255,255,0.05); color:white; }
        button { background:var(--accent); color:white; font-weight:bold; cursor:pointer; }
        .del { float:right; color:#ff7675; cursor:pointer; font-weight:bold; }
        .profile-btn { position:fixed; bottom:25px; left:25px; width:60px; height:60px; border-radius:50%; background:var(--accent); border:3px solid white; z-index:2000; overflow:hidden; display:flex; align-items:center; justify-content:center; cursor:pointer; }
    `;

    if (!req.session.uid) {
        return res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head>
        <body style="display:flex; align-items:center; justify-content:center; height:100vh;">
            <div class="glass" style="width:320px; text-align:center;">
                <img src="${logo}" style="width:80px; margin-bottom:20px;">
                <form action="/auth" method="POST">
                    <input name="user" placeholder="Tu usuario" required>
                    <input name="pass" type="password" placeholder="Tu contraseña" required>
                    <input name="pin" placeholder="PIN Admin (si tienes)">
                    <button name="accion" value="login">ENTRAR</button>
                    <button name="accion" value="registro" style="background:none; color:var(--accent);">REGISTRARSE</button>
                </form>
            </div></body></html>`);
    }

    res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head>
    <body>
        <div class="splash">
            <img src="${splash}" style="max-width:150px; border-radius:20px; box-shadow:0 0 40px var(--accent); animation: pulse 1.5s infinite;">
            <h2 style="margin-top:20px; letter-spacing:3px;">CARGANDO...</h2>
        </div>
        <style>@keyframes pulse { 50% { transform:scale(1.1); opacity:0.7; } }</style>

        <div class="nav-top">BIBLIO MASTER PRO</div>
        <div class="tabs">
            <div class="tab active" onclick="ver('nov', this)">NOTICIAS</div>
            <div class="tab" onclick="ver('lib', this)">LIBROS</div>
            <div class="tab" onclick="ver('act', this)">ACTIVIDADES</div>
            <div class="tab" onclick="ver('pre', this)">PEDIDOS</div>
        </div>

        <div class="profile-btn" onclick="ver('adj', this)">
            ${u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover;">` : u.user[0].toUpperCase()}
        </div>

        <div class="container">
            
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="glass"><b>📢 Nueva Noticia</b><form action="/admin/add/nov" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><textarea name="texto" placeholder="Mensaje..."></textarea><input type="file" name="file" accept="image/*"><button>Publicar</button></form></div>` : ''}
                ${novs.map(n => `<div class="glass">
                    ${req.session.rol === 'admin' ? `<span class="del" onclick="borrar('nov','${n._id}')">×</span>` : ''}
                    <small>@${n.autor}</small><h3>${n.titulo}</h3><p style="opacity:0.8;">${n.texto}</p>
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:15px; margin-top:10px;">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="glass"><b>📚 Añadir Libro</b><form action="/admin/add/lib" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="file" accept="image/*"><button>Guardar</button></form></div>` : ''}
                ${libs.map(l => `<div class="glass" style="display:flex; gap:15px; align-items:center;">
                    <img src="${l.portada}" style="width:60px; height:90px; border-radius:8px; object-fit:cover;">
                    <div style="flex:1">
                        ${req.session.rol === 'admin' ? `<span class="del" onclick="borrar('lib','${l._id}')">×</span>` : ''}
                        <b>${l.titulo}</b><br><small>${l.autor}</small>
                        ${l.disponible ? `<form action="/user/reservar" method="POST" style="margin-top:10px; display:flex; gap:5px;"><input type="hidden" name="libroTitulo" value="${l.titulo}"><input name="curso" placeholder="Curso" required style="padding:5px;"><button style="width:60px; padding:5px;">Pedir</button></form>` : '<div style="color:#ff7675; margin-top:10px; font-size:12px;">Prestado</div>'}
                    </div>
                </div>`).join('')}
            </div>

            <div id="act" class="section">
                ${req.session.rol === 'admin' ? `
                <div class="glass">
                    <b>✨ Crear Actividad</b>
                    <form action="/admin/add/act" method="POST" enctype="multipart/form-data">
                        <input name="nombre" placeholder="Nombre de la actividad" required>
                        <input name="desc" placeholder="Descripción breve">
                        <div style="display:flex; gap:10px;"><input type="date" name="fecha"><input type="time" name="hora"></div>
                        <input type="number" name="cupos" placeholder="Plazas totales">
                        <input type="file" name="file" accept="image/*">
                        <button>Lanzar Actividad</button>
                    </form>
                </div>` : ''}
                ${acts.map(a => `
                <div class="glass" style="padding:0; overflow:hidden;">
                    ${a.imagen ? `<img src="${a.imagen}" style="width:100%; height:180px; object-fit:cover;">` : ''}
                    <div style="padding:20px;">
                        ${req.session.rol === 'admin' ? `<span class="del" onclick="borrar('act','${a._id}')">×</span>` : ''}
                        <h2 style="margin:0; color:var(--accent);">${a.nombre}</h2>
                        <p style="opacity:0.8; font-size:14px;">${a.desc}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <small>📅 ${a.fecha} | ⏰ ${a.hora}</small>
                            <small style="background:var(--accent); padding:3px 8px; border-radius:8px;">${a.asistentes.length}/${a.cupos} plazas</small>
                        </div>
                        <form action="/user/inscribir/${a._id}" method="POST" style="margin-top:15px;">
                            <button ${a.asistentes.length >= a.cupos ? 'disabled' : ''} style="${a.asistentes.length >= a.cupos ? 'filter:grayscale(1);' : ''}">
                                ${a.asistentes.length >= a.cupos ? 'AGOTADO' : 'APUNTARME'}
                            </button>
                        </form>
                    </div>
                </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${ress.map(r => `<div class="glass">
                    <b>${r.libroTitulo}</b><br><small>Alumno: ${r.usuario} (${r.curso})</small>
                    ${req.session.rol === 'admin' ? `<button onclick="borrar('pre','${r._id}')" style="background:#2ecc71; margin-top:10px;">RECIBIDO</button>` : ''}
                </div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="glass" style="text-align:center;">
                    <div style="width:80px; height:80px; border-radius:50%; margin:0 auto 15px; border:3px solid var(--accent); overflow:hidden;">
                        ${u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover;">` : u.user[0].toUpperCase()}
                    </div>
                    <h2>${u.user}</h2>
                    <form action="/user/config" method="POST" enctype="multipart/form-data">
                        <label>Foto de perfil:</label><input type="file" name="foto" accept="image/*">
                        <label>Color favorito:</label><input type="color" name="color" value="${u.color}" style="height:40px;">
                        <button>Guardar Cambios</button>
                    </form>

                    ${req.session.rol === 'admin' ? `
                    <hr style="opacity:0.1; margin:20px 0;">
                    <p><b>Ajustes de Sistema</b></p>
                    <form action="/admin/add/splash" method="POST" enctype="multipart/form-data">
                        <label>Cambiar Imagen de Splash:</label><input type="file" name="file" accept="image/*" required>
                        <button style="background:#f1c40f; color:black;">Actualizar Splash</button>
                    </form>
                    <form action="/admin/add/logo" method="POST" enctype="multipart/form-data">
                        <label>Cambiar Logo Principal:</label><input type="file" name="file" accept="image/*" required>
                        <button style="background:#f1c40f; color:black;">Actualizar Logo</button>
                    </form>
                    ` : ''}
                    <button onclick="location.href='/salir'" style="background:none; color:#ff7675;">Cerrar Sesión</button>
                </div>
            </div>
        </div>

        <form id="delForm" method="POST"></form>

        <script>
            function ver(id, el) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                if(el.classList.contains('tab')) el.classList.add('active');
                window.scrollTo(0,0);
            }
            function borrar(tipo, id) {
                if(confirm('¿Seguro?')) {
                    const f = document.getElementById('delForm');
                    f.action = '/admin/borrar/'+tipo+'/'+id;
                    f.submit();
                }
            }
        </script>
    </body></html>`);
});

app.use((err, req, res, next) => {
    res.status(500).send(`<h2>Error de Seguridad: ${err.message}</h2><a href="/">Volver</a>`);
});

app.listen(PORT, () => console.log('🔥 BIBLIO ULTRA FUNCIONANDO'));
