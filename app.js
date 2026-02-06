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
  .then(() => console.log("🚀 Biblio Master 2026: Sistema Global Activo"));

const upload = multer({ storage: multer.memoryStorage() });

// --- MODELOS ---
const Config = mongoose.model('Config', { logoURL: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, disponible: { type: Boolean, default: true } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroTitulo: String, fecha: { type: String, default: new Date().toLocaleDateString() } });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] } });
// NUEVO: Modelo de Actividades
const Actividad = mongoose.model('Actividad', { nombre: String, descripcion: String, fecha: String, hora: String, asistentes: { type: Array, default: [] } });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-mega-fix-2026', resave: false, saveUninitialized: false }));

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
    else res.send('Error de acceso.');
});

// RUTAS ADMIN
app.post('/admin/borrar-prestamo/:id', async (req, res) => {
    if (req.session.rol === 'admin') {
        const prestamo = await Reserva.findById(req.params.id);
        if(prestamo) {
            await Libro.findOneAndUpdate({ titulo: prestamo.libroTitulo }, { disponible: true });
            await Reserva.findByIdAndDelete(req.params.id);
        }
    }
    res.redirect('/');
});

app.post('/admin/subir-logo', upload.single('archivoPng'), async (req, res) => {
    if (req.session.rol === 'admin' && req.file) {
        const url = await subirImg(req.file.buffer);
        await Config.findOneAndUpdate({}, { logoURL: url }, { upsert: true });
    }
    res.redirect('/');
});

app.post('/admin/nueva-actividad', async (req, res) => {
    if (req.session.rol === 'admin') await new Actividad(req.body).save();
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    if (req.params.tipo === 'lib') await Libro.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'nov') await Novedad.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'tor') await Torneo.findByIdAndDelete(req.params.id);
    if (req.params.tipo === 'act') await Actividad.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

// RUTAS USUARIO
app.post('/reservar', async (req, res) => {
    const libro = await Libro.findOne({ titulo: req.body.libroTitulo });
    if (libro && libro.disponible) {
        await new Reserva({ ...req.body, usuario: req.session.u }).save();
        await Libro.findByIdAndUpdate(libro._id, { disponible: false });
    }
    res.redirect('/');
});

app.post('/inscribir/:tipo/:id', async (req, res) => {
    const u = await User.findById(req.session.uid);
    const Modelo = req.params.tipo === 'torneo' ? Torneo : Actividad;
    const item = await Modelo.findById(req.params.id);
    
    // Lista de nombres para evitar duplicados (ajustado para ambos modelos)
    const lista = req.params.tipo === 'torneo' ? item.participantes : item.asistentes;
    
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

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const conf = await Config.findOne();
    const logoActual = conf ? conf.logoURL : "https://via.placeholder.com/150?text=Logo";

    const u = await User.findById(req.session.uid);
    const novs = await Novedad.find().sort({ _id: -1 });
    const libs = await Libro.find().sort({ titulo: 1 });
    const tors = await Torneo.find().sort({ fecha: 1 });
    const acts = await Actividad.find().sort({ fecha: 1 });
    const ress = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    
    const avatar = u ? (u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase()) : "";

    const glassCSS = `
        body { margin:0; font-family:'Segoe UI', sans-serif; background: #0f172a; color:white; background: radial-gradient(circle at top, #1e293b, #0f172a); background-attachment: fixed; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; }
        input, button, textarea { width:100%; padding:12px; margin:8px 0; border-radius:12px; border:none; box-sizing:border-box; outline:none; font-family:inherit; }
        input, textarea { background: rgba(255,255,255,0.1); color:white; }
        button { cursor:pointer; font-weight:bold; transition: 0.3s; }
        .section { display:none; animation: fadeIn 0.4s; } .active-sec { display:block; }
        @keyframes fadeIn { from {opacity:0; transform:translateY(10px);} to {opacity:1; transform:translateY(0);} }
        .tab-scroll { position:fixed; top:52px; width:100%; display:flex; z-index:1000; overflow-x:auto; gap:5px; padding:10px; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); }
        .tab-scroll::-webkit-scrollbar { display:none; }
        .tab { padding:8px 15px; cursor:pointer; font-size:0.7em; border-radius:10px; color:#94a3b8; white-space:nowrap; flex-shrink:0; }
        .tab.active { background:${u ? u.color : '#3498db'}; color:white; }
        .container { max-width:450px; margin:150px auto 40px; padding:0 20px; }
        .card { padding:15px; margin-bottom:15px; position:relative; }
        .del { color:#ff7675; float:right; background:none; border:none; cursor:pointer; font-weight:bold; width:auto; margin:0; }
        .user-pic { width:30px; height:30px; border-radius:50%; border:1px solid white; display:inline-flex; justify-content:center; align-items:center; font-size:10px; overflow:hidden; margin-right:-8px; background:#444; }
    `;

    if (!req.session.uid) return res.send(`
        <style>${glassCSS} body { height:100vh; display:flex; justify-content:center; align-items:center; }</style>
        <div class="glass" style="padding:40px; width:310px; text-align:center;">
            <img src="${logoActual}" style="max-width:110px; margin-bottom:20px;">
            <form action="/auth" method="POST">
                <input name="user" placeholder="Usuario" required>
                <input name="pass" type="password" placeholder="Contraseña" required>
                <input name="pin" placeholder="PIN Admin (Opcional)">
                <button name="accion" value="login" style="background:#3498db; color:white;">Entrar</button>
                <button name="accion" value="registro" style="background:transparent; border:1px solid #3498db; color:#3498db;">Crear Cuenta</button>
            </form>
        </div>
    `);

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${glassCSS}</style>
    </head>
    <body>
        <div class="nav" style="position:fixed; top:0; width:100%; z-index:1000; padding:15px; text-align:center; background: #0f172a; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:bold;">BIBLIOTECA MASTER</div>
        
        <div class="tab-scroll">
            <div class="tab active" onclick="ver('nov', this)">NOTICIAS</div>
            <div class="tab" onclick="ver('lib', this)">LIBROS</div>
            <div class="tab" onclick="ver('act', this)">ACTIVIDADES</div>
            <div class="tab" onclick="ver('pre', this)">PRÉSTAMOS</div>
            <div class="tab" onclick="ver('tor', this)">TORNEOS</div>
        </div>

        <div style="position:fixed; bottom:25px; left:25px; width:55px; height:55px; border-radius:50%; z-index:2000; border:2px solid white; background:${u.color}; display:flex; justify-content:center; align-items:center; cursor:pointer; overflow:hidden;" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            
            <div id="nov" class="section active-sec">
                ${novs.map(n => `<div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/nov/${n._id}" method="POST" style="float:right;"><button class="del">×</button></form>` : ''}
                    <b style="color:${u.color}">${n.autor}</b><br><h3>${n.titulo}</h3><p style="opacity:0.8; font-size:0.9em;">${n.texto}</p>
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:12px; margin-top:10px;">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada"><button style="background:${u.color};">Añadir</button></form></div>` : ''}
                ${libs.map(l => `<div class="glass card">
                    <img src="${l.portada}" style="width:50px; height:70px; float:left; margin-right:12px; border-radius:5px; object-fit:cover;">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/lib/${l._id}" method="POST"><button class="del">×</button></form>` : ''}
                    <b>${l.titulo}</b><br><small>${l.autor}</small>
                    <div style="clear:both; padding-top:10px;">
                        ${l.disponible ? `<form action="/reservar" method="POST" style="display:flex; gap:5px;"><input type="hidden" name="libroTitulo" value="${l.titulo}"><input name="curso" placeholder="Curso" required style="padding:5px; font-size:0.8em;"><button style="background:#2ecc71; width:80px; padding:5px;">Pedir</button></form>` : '<span style="color:#ff7675; font-size:0.8em;">Prestado</span>'}
                    </div>
                </div>`).join('')}
            </div>

            <div id="act" class="section">
                ${req.session.rol === 'admin' ? `
                <div class="card glass">
                    <b>📅 Crear Actividad</b>
                    <form action="/admin/nueva-actividad" method="POST">
                        <input name="nombre" placeholder="Nombre: Taller de Cómic, Charla..." required>
                        <textarea name="description" placeholder="¿De qué trata?"></textarea>
                        <div style="display:flex; gap:5px;">
                            <input type="date" name="fecha" required>
                            <input type="time" name="hora" required>
                        </div>
                        <button style="background:${u.color};">Publicar Actividad</button>
                    </form>
                </div>` : ''}
                ${acts.map(a => `<div class="glass card" style="border-left: 4px solid #f1c40f;">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/act/${a._id}" method="POST" style="float:right;"><button class="del">×</button></form>` : ''}
                    <h3 style="margin:0; color:#f1c40f;">✨ ${a.nombre}</h3>
                    <p style="font-size:0.85em; opacity:0.8; margin:8px 0;">${a.description || 'Sin descripción.'}</p>
                    <small>📅 ${a.fecha} | ⏰ ${a.hora}</small>
                    <div style="margin:10px 0;">
                        ${a.asistentes.map(p => `<div class="user-pic">${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; object-fit:cover;">` : p.nombre[0]}</div>`).join('')}
                    </div>
                    <form action="/inscribir/actividad/${a._id}" method="POST"><button style="background:${u.color}; font-size:0.8em;">¡Me apunto!</button></form>
                </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${ress.map(r => `<div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar-prestamo/${r._id}" method="POST" style="float:right;"><button style="background:#2ecc71; font-size:0.7em; width:auto; padding:5px;">Devuelto</button></form>` : ''}
                    <b>${r.libroTitulo}</b><br><small>Alumno: ${r.usuario} (${r.curso})</small>
                </div>`).join('')}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>🏆 Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:${u.color};">Crear</button></form></div>` : ''}
                ${tors.map(t => `<div class="glass card">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar/tor/${t._id}" method="POST" style="float:right;"><button class="del">×</button></form>` : ''}
                    <h3 style="margin:0; color:${u.color}">🏆 ${t.nombre}</h3><small>${t.fecha}</small>
                    <div style="margin:10px 0;">
                        ${t.participantes.map(p => `<div class="user-pic">${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; object-fit:cover;">` : p.nombre[0]}</div>`).join('')}
                    </div>
                    <form action="/inscribir/torneo/${t._id}" method="POST"><button style="background:${u.color};">Inscribirme</button></form>
                </div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="glass card" style="text-align:center;">
                    <div style="width:80px; height:80px; border-radius:50%; margin:0 auto 10px; background:${u.color}; border:2px solid white; display:flex; justify-content:center; align-items:center; overflow:hidden;">${avatar}</div>
                    <h3>${u.user}</h3>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto">
                        <input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color};">Guardar</button>
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
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Biblio Master 2026: OK'));
