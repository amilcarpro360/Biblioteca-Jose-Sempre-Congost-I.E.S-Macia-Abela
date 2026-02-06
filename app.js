const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN CLOUDINARY ---
cloudinary.config({ 
    cloud_name: 'dvlbsl16g', 
    api_key: '721617469253873', 
    api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});

// --- CONEXIÓN MONGODB ---
mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/bibliotecaDB")
    .then(() => console.log("✅ Conectado a MongoDB - Sistema Listo"))
    .catch(err => console.error("❌ Error de conexión:", err));

// --- MODELOS ---
const Config = mongoose.model('Config', { logoURL: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, disponible: { type: Boolean, default: true } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroTitulo: String, fecha: { type: String, default: new Date().toLocaleDateString() } });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] } });
const Actividad = mongoose.model('Actividad', { nombre: String, descripcion: String, fecha: String, hora: String, asistentes: { type: Array, default: [] } });

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ 
    secret: 'secreto-biblio-2026', 
    resave: false, 
    saveUninitialized: false 
}));

const upload = multer({ storage: multer.memoryStorage() });

// Función para subir a Cloudinary
const subirImg = (buffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream({ folder: "biblioteca" }, (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
        });
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    try {
        if (accion === 'registro') {
            const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
            const nuevo = new User({ user, pass, rol });
            await nuevo.save();
            req.session.uid = nuevo._id; req.session.rol = nuevo.rol; req.session.u = nuevo.user;
            return res.redirect('/');
        }
        const u = await User.findOne({ user, pass });
        if (u) { 
            req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user; 
            res.redirect('/'); 
        } else {
            res.send('<h2>Error: Usuario o contraseña incorrectos.</h2><a href="/">Volver</a>');
        }
    } catch (e) { res.send("Error en el proceso."); }
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- RUTAS ADMIN ---
app.post('/admin/novedad', upload.single('imagen'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImg(req.file.buffer) : "";
    await new Novedad({ ...req.body, imagen: img, fecha: new Date().toLocaleDateString(), autor: req.session.u }).save();
    res.redirect('/');
});

app.post('/admin/nuevo-libro', upload.single('portada'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImg(req.file.buffer) : "";
    await new Libro({ ...req.body, portada: img }).save();
    res.redirect('/');
});

app.post('/admin/nueva-actividad', async (req, res) => {
    if (req.session.rol === 'admin') await new Actividad(req.body).save();
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    const { tipo, id } = req.params;
    if (tipo === 'lib') await Libro.findByIdAndDelete(id);
    if (tipo === 'nov') await Novedad.findByIdAndDelete(id);
    if (tipo === 'tor') await Torneo.findByIdAndDelete(id);
    if (tipo === 'act') await Actividad.findByIdAndDelete(id);
    res.redirect('/');
});

app.post('/admin/borrar-prestamo/:id', async (req, res) => {
    if (req.session.rol === 'admin') {
        const p = await Reserva.findByIdAndDelete(req.params.id);
        if (p) await Libro.findOneAndUpdate({ titulo: p.libroTitulo }, { disponible: true });
    }
    res.redirect('/');
});

// --- RUTAS USUARIO ---
app.post('/reservar', async (req, res) => {
    if (!req.session.uid) return res.redirect('/');
    const lib = await Libro.findOne({ titulo: req.body.libroTitulo });
    if (lib && lib.disponible) {
        await new Reserva({ ...req.body, usuario: req.session.u }).save();
        await Libro.findByIdAndUpdate(lib._id, { disponible: false });
    }
    res.redirect('/');
});

app.post('/inscribir/:tipo/:id', async (req, res) => {
    if (!req.session.uid) return res.redirect('/');
    const u = await User.findById(req.session.uid);
    const Modelo = req.params.tipo === 'torneo' ? Torneo : Actividad;
    const item = await Modelo.findById(req.params.id);
    
    let lista = req.params.tipo === 'torneo' ? item.participantes : item.asistentes;
    if (!lista.some(p => p.nombre === u.user)) {
        lista.push({ nombre: u.user, foto: u.foto || "" });
        await item.save();
    }
    res.redirect('/');
});

app.post('/ajustes', upload.single('foto'), async (req, res) => {
    let update = { color: req.body.color };
    if (req.file) update.foto = await subirImg(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, update);
    res.redirect('/');
});

// --- VISTA PRINCIPAL ---
app.get('/', async (req, res) => {
    const conf = await Config.findOne();
    const logo = conf ? conf.logoURL : "https://cdn-icons-png.flaticon.com/512/2232/2232688.png";

    // CSS Estilo Glassmorphism
    const css = `
        body { margin:0; font-family:sans-serif; background:#0f172a; color:white; padding-bottom:50px; }
        .glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 15px; margin-bottom: 15px; }
        .nav { position:fixed; top:0; width:100%; background:#1e293b; z-index:1000; text-align:center; padding:10px 0; font-weight:bold; border-bottom:1px solid #334155; }
        .tabs { position:fixed; top:45px; width:100%; display:flex; overflow-x:auto; background:#0f172a; z-index:999; padding:10px 0; }
        .tab { padding:8px 15px; cursor:pointer; font-size:12px; white-space:nowrap; color:#94a3b8; }
        .tab.active { color:white; font-weight:bold; border-bottom: 2px solid #3498db; }
        .container { max-width:500px; margin:120px auto 20px; padding: 0 15px; }
        input, button, textarea { width:100%; padding:10px; margin:5px 0; border-radius:8px; border:none; box-sizing:border-box; }
        button { cursor:pointer; background:#3498db; color:white; font-weight:bold; }
        .section { display:none; } .active-sec { display:block; }
        .avatar-circle { width:50px; height:50px; border-radius:50%; border:2px solid white; position:fixed; bottom:20px; left:20px; z-index:1001; cursor:pointer; overflow:hidden; background:#3498db; display:flex; align-items:center; justify-content:center; }
    `;

    if (!req.session.uid) {
        return res.send(`<html><style>${css}</style><body style="display:flex; align-items:center; justify-content:center; height:100vh;">
            <div class="glass" style="width:300px; text-align:center;">
                <img src="${logo}" width="80">
                <form action="/auth" method="POST">
                    <input name="user" placeholder="Usuario" required>
                    <input name="pass" type="password" placeholder="Contraseña" required>
                    <input name="pin" placeholder="PIN Admin (Opcional)">
                    <button name="accion" value="login">Entrar</button>
                    <button name="accion" value="registro" style="background:none; color:#3498db;">Crear cuenta</button>
                </form>
            </div></body></html>`);
    }

    const u = await User.findById(req.session.uid);
    const novs = await Novedad.find().sort({ _id: -1 });
    const libs = await Libro.find().sort({ titulo: 1 });
    const acts = await Actividad.find().sort({ fecha: 1 });
    const tors = await Torneo.find().sort({ fecha: 1 });
    const ress = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });

    res.send(`
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head>
    <body>
        <div class="nav">BIBLIOTECA MASTER</div>
        <div class="tabs">
            <div class="tab active" onclick="ver('nov', this)">NOTICIAS</div>
            <div class="tab" onclick="ver('lib', this)">LIBROS</div>
            <div class="tab" onclick="ver('act', this)">ACTIVIDADES</div>
            <div class="tab" onclick="ver('pre', this)">PRÉSTAMOS</div>
            <div class="tab" onclick="ver('tor', this)">TORNEOS</div>
        </div>

        <div class="avatar-circle" onclick="ver('adj', this)" style="background:${u.color}">
            ${u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover;">` : u.user[0].toUpperCase()}
        </div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="glass"><b>Nueva Noticia</b><form action="/admin/novedad" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><textarea name="texto" placeholder="Texto"></textarea><input type="file" name="imagen"><button>Publicar</button></form></div>` : ''}
                ${novs.map(n => `<div class="glass"><h3>${n.titulo}</h3><p>${n.texto}</p>${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:10px;">` : ''}</div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="glass"><b>Nuevo Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada"><button>Añadir</button></form></div>` : ''}
                ${libs.map(l => `<div class="glass">
                    <img src="${l.portada}" style="width:50px; height:70px; float:left; margin-right:10px; border-radius:5px;">
                    <b>${l.titulo}</b><br><small>${l.autor}</small>
                    <div style="clear:both; padding-top:10px;">
                        ${l.disponible ? `<form action="/reservar" method="POST" style="display:flex; gap:5px;"><input type="hidden" name="libroTitulo" value="${l.titulo}"><input name="curso" placeholder="Curso" required><button style="width:80px;">Pedir</button></form>` : '<span style="color:#ff7675;">Ocupado</span>'}
                    </div>
                </div>`).join('')}
            </div>

            <div id="act" class="section">
                ${req.session.rol === 'admin' ? `<div class="glass"><b>Nueva Actividad</b><form action="/admin/nueva-actividad" method="POST"><input name="nombre" placeholder="Nombre"><input name="description" placeholder="Descripción"><input type="date" name="fecha"><input type="time" name="hora"><button>Crear</button></form></div>` : ''}
                ${acts.map(a => `<div class="glass">
                    <h3 style="color:#f1c40f;">${a.nombre}</h3><p>${a.description}</p><small>${a.fecha} - ${a.hora}</small>
                    <form action="/inscribir/actividad/${a._id}" method="POST" style="margin-top:10px;"><button style="background:${u.color}">Inscribirme</button></form>
                </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${ress.map(r => `<div class="glass"><b>${r.libroTitulo}</b><br><small>${r.usuario} (${r.curso})</small>
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar-prestamo/${r._id}" method="POST"><button style="background:#2ecc71; margin-top:5px;">Devuelto</button></form>` : ''}
                </div>`).join('')}
            </div>

            <div id="tor" class="section">
                ${tors.map(t => `<div class="glass"><h3>🏆 ${t.nombre}</h3><small>${t.fecha}</small>
                <form action="/inscribir/torneo/${t._id}" method="POST" style="margin-top:10px;"><button style="background:${u.color}">Participar</button></form></div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="glass" style="text-align:center;">
                    <h2>Ajustes</h2>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto"><input type="color" name="color" value="${u.color}">
                        <button>Guardar</button>
                    </form>
                    <a href="/salir" style="color:#ff7675; text-decoration:none; display:block; margin-top:20px;">Cerrar Sesión</a>
                </div>
            </div>
        </div>

        <script>
            function ver(id, el) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                if(el && el.classList.contains('tab')) el.classList.add('active');
            }
        </script>
    </body></html>`);
});

app.listen(PORT, () => console.log('Servidor en http://localhost:' + PORT));
