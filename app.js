const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG ---
cloudinary.config({ 
    cloud_name: 'dvlbsl16g', 
    api_key: '721617469253873', 
    api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/BiblioMasterPRO")
    .then(() => console.log("🚀 BIBLIO MASTER PRO 2026 CONECTADA"));

// --- MODELOS MEJORADOS ---
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: { type: Date, default: Date.now }, autor: String });
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, disponible: { type: Boolean, default: true }, categoria: String });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroTitulo: String, fecha: { type: Date, default: Date.now } });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: { type: Array, default: [] }, maxParticipantes: { type: Number, default: 20 } });
const Actividad = mongoose.model('Actividad', { nombre: String, desc: String, fecha: String, hora: String, asistentes: { type: Array, default: [] }, cupos: Number });

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'master-key-2026', resave: false, saveUninitialized: false }));
const upload = multer({ storage: multer.memoryStorage() });

const subirImg = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v5" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- LÓGICA DE RUTAS ---

// Auth
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

// Admin Actions
app.post('/admin/add/:tipo', upload.single('file'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImg(req.file.buffer) : "";
    
    if (req.params.tipo === 'nov') await new Novedad({ ...req.body, imagen: img, autor: req.session.u }).save();
    if (req.params.tipo === 'lib') await new Libro({ ...req.body, portada: img }).save();
    if (req.params.tipo === 'act') await new Actividad(req.body).save();
    if (req.params.tipo === 'tor') await new Torneo(req.body).save();
    res.redirect('/');
});

app.post('/admin/borrar/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    const { tipo, id } = req.params;
    if (tipo === 'lib') await Libro.findByIdAndDelete(id);
    if (tipo === 'nov') await Novedad.findByIdAndDelete(id);
    if (tipo === 'act') await Actividad.findByIdAndDelete(id);
    if (tipo === 'tor') await Torneo.findByIdAndDelete(id);
    if (tipo === 'pre') {
        const r = await Reserva.findByIdAndDelete(id);
        if (r) await Libro.findOneAndUpdate({ titulo: r.libroTitulo }, { disponible: true });
    }
    res.redirect('/');
});

// User Actions
app.post('/user/reservar', async (req, res) => {
    const l = await Libro.findOne({ titulo: req.body.libroTitulo, disponible: true });
    if (l) {
        await new Reserva({ ...req.body, usuario: req.session.u }).save();
        l.disponible = false; await l.save();
    }
    res.redirect('/');
});

app.post('/user/inscribir/:tipo/:id', async (req, res) => {
    const Model = req.params.tipo === 'act' ? Actividad : Torneo;
    const item = await Model.findById(req.params.id);
    const u = await User.findById(req.session.uid);
    
    const lista = req.params.tipo === 'act' ? item.asistentes : item.participantes;
    const max = req.params.tipo === 'act' ? item.cupos : item.maxParticipantes;

    if (lista.length < max && !lista.some(p => p.nombre === u.user)) {
        lista.push({ nombre: u.user, foto: u.foto || "" });
        await item.save();
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

// --- INTERFAZ MAESTRA ---
app.get('/', async (req, res) => {
    if (!req.session.uid) return res.send(loginPage());

    const [u, novs, libs, acts, tors, ress] = await Promise.all([
        User.findById(req.session.uid),
        Novedad.find().sort({ fecha: -1 }),
        Libro.find().sort({ titulo: 1 }),
        Actividad.find().sort({ fecha: 1 }),
        Torneo.find().sort({ fecha: 1 }),
        Reserva.find(req.session.rol === 'admin' ? {} : { usuario: req.session.u })
    ]);

    const color = u.color;
    const avatar = u.foto ? `<img src="${u.foto}" class="ava-full">` : u.user[0].toUpperCase();

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            :root { --accent: ${color}; }
            body { margin:0; font-family:'Poppins', sans-serif; background:#0f172a; color:#f8fafc; overflow-x:hidden; }
            .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 20px; margin-bottom: 20px; }
            .nav-top { position:fixed; top:0; width:100%; height:60px; background:rgba(15,23,42,0.9); display:flex; align-items:center; justify-content:center; font-weight:900; z-index:2000; border-bottom:1px solid rgba(255,255,255,0.05); }
            .tab-bar { position:fixed; top:60px; width:100%; display:flex; overflow-x:auto; background:rgba(15,23,42,0.8); z-index:1999; padding:10px 0; gap:10px; border-bottom:1px solid rgba(255,255,255,0.05); scrollbar-width: none; }
            .tab { padding:10px 20px; border-radius:15px; cursor:pointer; font-size:13px; font-weight:bold; color:#64748b; white-space:nowrap; transition:0.3s; }
            .tab.active { background:var(--accent); color:white; box-shadow: 0 10px 20px -5px var(--accent); }
            .container { max-width:500px; margin:150px auto 50px; padding:0 20px; }
            .section { display:none; animation: slideUp 0.4s ease; } .active-sec { display:block; }
            @keyframes slideUp { from {opacity:0; transform:translateY(20px);} to {opacity:1; transform:translateY(0);} }
            
            input, textarea, select { width:100%; padding:12px; margin:8px 0; border-radius:14px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; outline:none; }
            button { width:100%; padding:12px; border-radius:14px; border:none; background:var(--accent); color:white; font-weight:bold; cursor:pointer; }
            
            .btn-profile { position:fixed; bottom:30px; left:30px; width:60px; height:60px; border-radius:50%; background:var(--accent); border:3px solid #fff; display:flex; align-items:center; justify-content:center; font-weight:bold; cursor:pointer; z-index:2001; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
            .ava-full { width:100%; height:100%; object-fit:cover; }
            .badge { padding:4px 10px; border-radius:10px; font-size:11px; font-weight:bold; }
            .del-btn { position:absolute; top:10px; right:10px; background:rgba(255,0,0,0.2); color:#ff7675; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; }
        </style>
    </head>
    <body>
        <div class="nav-top">BIBLIOTECA MASTER 2026</div>
        <div class="tab-bar">
            <div style="width:20px"></div>
            <div class="tab active" onclick="ver('nov', this)">FEED</div>
            <div class="tab" onclick="ver('lib', this)">ESTANTERÍA</div>
            <div class="tab" onclick="ver('act', this)">ACTIVIDADES</div>
            <div class="tab" onclick="ver('pre', this)">PRÉSTAMOS</div>
            <div class="tab" onclick="ver('tor', this)">TORNEOS</div>
            <div style="width:20px"></div>
        </div>

        <div class="btn-profile" onclick="ver('cfg', this)">${avatar}</div>

        <div class="container">
            
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `
                <div class="glass">
                    <b>📢 Publicar Novedad</b>
                    <form action="/admin/add/nov" method="POST" enctype="multipart/form-data">
                        <input name="titulo" placeholder="Título de la noticia" required>
                        <textarea name="texto" placeholder="¿Qué quieres contar hoy?" rows="3"></textarea>
                        <input type="file" name="file" accept="image/*">
                        <button>Lanzar Noticia</button>
                    </form>
                </div>` : ''}
                ${novs.map(n => `
                <div class="glass" style="position:relative">
                    ${req.session.rol === 'admin' ? `<div class="del-btn" onclick="borrar('nov','${n._id}')">×</div>` : ''}
                    <small style="color:var(--accent)">@${n.autor}</small> • <small style="opacity:0.5">${new Date(n.fecha).toLocaleDateString()}</small>
                    <h3 style="margin:8px 0">${n.titulo}</h3>
                    <p style="opacity:0.8; font-size:14px">${n.texto}</p>
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:16px; margin-top:10px">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                <input type="text" id="buscalibros" placeholder="🔍 Buscar por título, autor o género..." onkeyup="search()">
                ${req.session.rol === 'admin' ? `
                <div class="glass">
                    <b>📚 Registrar Libro</b>
                    <form action="/admin/add/lib" method="POST" enctype="multipart/form-data">
                        <input name="titulo" placeholder="Título del libro" required>
                        <input name="autor" placeholder="Autor">
                        <input name="categoria" placeholder="Género (Terror, Sci-Fi...)">
                        <input type="file" name="file" required>
                        <button>Guardar Libro</button>
                    </form>
                </div>` : ''}
                <div id="grid-libros">
                ${libs.map(l => `
                <div class="glass lib-card" data-search="${l.titulo} ${l.autor} ${l.categoria}" style="display:flex; gap:15px; align-items:center;">
                    <img src="${l.portada}" style="width:70px; height:100px; border-radius:12px; object-fit:cover; filter:${l.disponible ? 'none' : 'grayscale(1)'}">
                    <div style="flex:1">
                        ${req.session.rol === 'admin' ? `<div class="del-btn" onclick="borrar('lib','${l._id}')">×</div>` : ''}
                        <h4 style="margin:0">${l.titulo}</h4>
                        <small style="opacity:0.6">${l.autor}</small><br>
                        <span class="badge" style="background:rgba(255,255,255,0.1)">${l.categoria}</span><br>
                        ${l.disponible ? `
                        <form action="/user/reservar" method="POST" style="margin-top:10px; display:flex; gap:5px;">
                            <input type="hidden" name="libroTitulo" value="${l.titulo}">
                            <input name="curso" placeholder="Curso" required style="padding:5px; margin:0; font-size:12px">
                            <button style="padding:5px; width:70px; font-size:12px; background:#2ecc71">Pedir</button>
                        </form>` : `<div style="margin-top:10px; color:#ff7675; font-size:12px; font-weight:bold">🚫 Prestado actualmente</div>`}
                    </div>
                </div>`).join('')}
                </div>
            </div>

            <div id="act" class="section">
                ${req.session.rol === 'admin' ? `
                <div class="glass">
                    <b>📅 Programar Actividad</b>
                    <form action="/admin/add/act" method="POST">
                        <input name="nombre" placeholder="Nombre (Taller de manga, charla...)">
                        <input name="desc" placeholder="Descripción corta">
                        <div style="display:flex; gap:10px">
                            <input type="date" name="fecha">
                            <input type="time" name="hora">
                        </div>
                        <input type="number" name="cupos" placeholder="Plazas disponibles (ej: 15)">
                        <button>Crear Evento</button>
                    </form>
                </div>` : ''}
                ${acts.map(a => `
                <div class="glass" style="border-left:5px solid #f1c40f">
                    ${req.session.rol === 'admin' ? `<div class="del-btn" onclick="borrar('act','${a._id}')">×</div>` : ''}
                    <h3 style="margin:0; color:#f1c40f">🌟 ${a.nombre}</h3>
                    <p style="font-size:13px; opacity:0.8">${a.desc}</p>
                    <small>📅 ${a.fecha} | ⏰ ${a.hora}</small><br>
                    <div style="margin:10px 0; display:flex; align-items:center; gap:10px">
                        <div style="flex:1; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden">
                            <div style="width:${(a.asistentes.length / a.cupos) * 100}%; height:100%; background:#f1c40f"></div>
                        </div>
                        <small>${a.asistentes.length}/${a.cupos} plazas</small>
                    </div>
                    <form action="/user/inscribir/act/${a._id}" method="POST">
                        <button style="background:#f1c40f; color:#000" ${a.asistentes.length >= a.cupos ? 'disabled' : ''}>
                            ${a.asistentes.length >= a.cupos ? 'COMPLETO' : 'APUNTARME'}
                        </button>
                    </form>
                </div>`).join('')}
            </div>

            <div id="pre" class="section">
                <h3 style="text-align:center">📋 Control de Libros</h3>
                ${ress.map(r => `
                <div class="glass" style="border-left:5px solid #2ecc71">
                    <b>${r.libroTitulo}</b><br>
                    <small>Alumno: ${r.usuario} (${r.curso})</small><br>
                    <small style="opacity:0.5">Fecha pedido: ${new Date(r.fecha).toLocaleDateString()}</small>
                    ${req.session.rol === 'admin' ? `
                    <form action="/admin/borrar/pre/${r._id}" method="POST" style="margin-top:10px">
                        <button style="background:#2ecc71">MARCAR COMO DEVUELTO</button>
                    </form>` : ''}
                </div>`).join('')}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `
                <div class="glass">
                    <b>🏆 Nuevo Torneo</b>
                    <form action="/admin/add/tor" method="POST">
                        <input name="nombre" placeholder="Nombre del torneo">
                        <input name="fecha" type="date">
                        <button>Lanzar Competición</button>
                    </form>
                </div>` : ''}
                ${tors.map(t => `
                <div class="glass">
                    ${req.session.rol === 'admin' ? `<div class="del-btn" onclick="borrar('tor','${t._id}')">×</div>` : ''}
                    <h2 style="margin:0">🏆 ${t.nombre}</h2>
                    <p>Cita: ${t.fecha}</p>
                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px">
                        ${t.participantes.map(p => `<div style="width:30px; height:30px; border-radius:50%; background:var(--accent); border:1px solid #fff; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:10px">${p.foto ? `<img src="${p.foto}" class="ava-full">` : p.nombre[0]}</div>`).join('')}
                    </div>
                    <form action="/user/inscribir/tor/${t._id}" method="POST"><button>PARTICIPAR</button></form>
                </div>`).join('')}
            </div>

            <div id="cfg" class="section">
                <div class="glass" style="text-align:center">
                    <div style="width:100px; height:100px; border-radius:50%; margin:0 auto 20px; border:4px solid var(--accent); overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:40px; font-weight:bold">
                        ${avatar}
                    </div>
                    <h2>${u.user}</h2>
                    <form action="/user/config" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto">
                        <input type="color" name="color" value="${u.color}">
                        <button>GUARDAR AJUSTES</button>
                    </form>
                    <button onclick="location.href='/salir'" style="background:rgba(255,0,0,0.1); color:#ff7675; margin-top:20px">CERRAR SESIÓN</button>
                </div>
            </div>

        </div>

        <form id="deleteForm" method="POST"></form>

        <script>
            function ver(id, el) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                if(el && el.classList.contains('tab')) el.classList.add('active');
                window.scrollTo(0,0);
            }
            function search() {
                let val = document.getElementById('buscalibros').value.toLowerCase();
                document.querySelectorAll('.lib-card').forEach(c => {
                    c.style.display = c.getAttribute('data-search').toLowerCase().includes(val) ? "flex" : "none";
                });
            }
            function borrar(tipo, id) {
                if(confirm('¿Seguro que quieres borrar esto?')) {
                    const f = document.getElementById('deleteForm');
                    f.action = '/admin/borrar/'+tipo+'/'+id;
                    f.submit();
                }
            }
        </script>
    </body>
    </html>`);
});

function loginPage() {
    return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    body{margin:0;background:#0f172a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;}
    .box{background:rgba(255,255,255,0.05);padding:40px;border-radius:30px;text-align:center;width:300px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);}
    input{width:100%;padding:12px;margin:10px 0;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:white;border-radius:10px;box-sizing:border-box;}
    button{width:100%;padding:12px;background:#3498db;border:none;color:white;border-radius:10px;font-weight:bold;cursor:pointer;}
    </style></head><body>
    <div class="box">
        <h1>BIBLIO</h1>
        <form action="/auth" method="POST">
            <input name="user" placeholder="Usuario" required>
            <input name="pass" type="password" placeholder="Contraseña" required>
            <input name="pin" placeholder="PIN Admin (Opcional)">
            <button name="accion" value="login">ENTRAR</button>
            <button name="accion" value="registro" style="background:none;color:#3498db;margin-top:10px">REGISTRARSE</button>
        </form>
    </div></body></html>`;
}

app.listen(PORT, () => console.log('🔥 BIBLIO MASTER PRO 2026: FUNCIONANDO'));
