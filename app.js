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

const upload = multer({ storage: multer.memoryStorage() });

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Biblio Admin Pro Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: { type: Array, default: [] } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: { type: String, default: "" } });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'glass-edit-2026', resave: false, saveUninitialized: false }));

const subirImagen = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS DE BORRADO (NUEVAS) ---
app.post('/admin/borrar-libro/:id', async (req, res) => {
    if (req.session.rol === 'admin') await Libro.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/admin/borrar-novedad/:id', async (req, res) => {
    if (req.session.rol === 'admin') await Novedad.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/admin/borrar-torneo/:id', async (req, res) => {
    if (req.session.rol === 'admin') await Torneo.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

// --- RUTAS DE ACCIÓN ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send('Registrado. <a href="/">Entrar</a>');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.uid = u._id; req.session.rol = u.rol; req.session.u = u.user; res.redirect('/'); }
    else res.send('Error.');
});

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
    if (req.file) update.foto = await subirImagen(req.file.buffer);
    await User.findByIdAndUpdate(req.session.uid, update);
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ GLASS ---
app.get('/', async (req, res) => {
    const glassCSS = `
        body { margin:0; font-family:sans-serif; background: linear-gradient(135deg, #1e2a38, #000); background-attachment: fixed; color:white; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        input, select, textarea { width:100%; padding:10px; margin:8px 0; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:white; outline:none; box-sizing:border-box; }
        button { width:100%; padding:10px; border-radius:10px; border:none; background:#3498db; color:white; font-weight:bold; cursor:pointer; }
        .del-btn { background:#ff7675; width:auto; padding:5px 10px; font-size:0.7em; margin-top:5px; float:right; }
    `;

    if (!req.session.uid) return res.send(`<style>${glassCSS} body { height:100vh; display:flex; justify-content:center; align-items:center; }</style><div class="glass" style="padding:40px; width:300px; text-align:center;"><h2>Biblio App</h2><form action="/auth" method="POST"><input name="user" placeholder="User" required><input name="pass" type="password" placeholder="Pass" required><input name="pin" placeholder="PIN Admin"><button name="accion" value="login">Entrar</button><button name="accion" value="registro" style="background:none; color:#888;">Registrar</button></form></div>`);

    const u = await User.findById(req.session.uid);
    const libros = await Libro.find();
    const misRes = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const novs = await Novedad.find().sort({ _id: -1 });
    const tors = await Torneo.find();
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            ${glassCSS}
            .nav { position:fixed; top:0; width:100%; z-index:1000; padding:15px; box-sizing:border-box; text-align:center; font-weight:bold; background:${u.color}55; backdrop-filter:blur(10px); }
            .tabs { position:fixed; top:50px; width:100%; display:flex; z-index:1000; justify-content:center; padding:10px 0; }
            .tab { padding:10px 15px; margin:0 5px; cursor:pointer; font-size:0.8em; opacity:0.6; }
            .tab.active { opacity:1; background:rgba(255,255,255,0.15); border-radius:12px; }
            .container { max-width:450px; margin:110px auto 30px; padding:0 20px; }
            .card { padding:15px; margin-bottom:15px; position:relative; }
            .btn-user { position:fixed; bottom:25px; left:25px; width:55px; height:55px; border-radius:50%; display:flex; justify-content:center; align-items:center; z-index:1500; border:2px solid white; overflow:hidden; background:${u.color}; }
            .section { display:none; } .active-sec { display:block; }
            .portada { width:65px; height:90px; border-radius:8px; float:left; margin-right:12px; object-fit:cover; }
        </style>
    </head>
    <body>
        <div class="nav">BIBLIOTECA MASTER</div>
        <div class="tabs">
            <div class="tab glass active" onclick="ver('nov', this)">📢</div>
            <div class="tab glass" onclick="ver('lib', this)">📚</div>
            <div class="tab glass" onclick="ver('pre', this)">🤝</div>
            <div class="tab glass" onclick="ver('tor', this)">🏆</div>
        </div>

        <div class="btn-user" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Novedad</b><form action="/admin/novedad" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><textarea name="texto" placeholder="Mensaje..."></textarea><input type="file" name="imagen" accept="image/*"><button style="background:${u.color};">Publicar</button></form></div>` : ''}
                ${novs.map(n => `<div class="card glass">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar-novedad/${n._id}" method="POST" onsubmit="return confirm('¿Borrar noticia?')"><button class="del-btn">Eliminar</button></form>` : ''}
                    ${n.imagen ? `<img src="${n.imagen}" style="width:100%; border-radius:10px; margin-bottom:10px;">`:''}
                    <h3>${n.titulo}</h3><p style="opacity:0.8; font-size:0.8em;">${n.texto}</p>
                </div>`).join('')}
            </div>

            <div id="lib" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Añadir Libro</b><form action="/admin/nuevo-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada" accept="image/*"><button style="background:${u.color};">Añadir</button></form></div>` : ''}
                ${libros.map(l => `
                    <div class="card glass">
                        ${req.session.rol === 'admin' ? `<form action="/admin/borrar-libro/${l._id}" method="POST" onsubmit="return confirm('¿Borrar libro?')"><button class="del-btn">Eliminar</button></form>` : ''}
                        <img src="${l.portada}" class="portada">
                        <b>${l.titulo}</b><br><small>${l.autor}</small>
                        <form action="/reservar" method="POST" style="clear:both; padding-top:10px;">
                            <input type="hidden" name="libroId" value="${l._id}"><input type="hidden" name="libroTitulo" value="${l.titulo}">
                            <input name="curso" placeholder="Curso" required style="width:60%; display:inline-block;">
                            <button style="width:35%; background:#2ecc71; display:inline-block;">Pedir</button>
                        </form>
                    </div>`).join('')}
            </div>

            <div id="pre" class="section">
                ${misRes.map(r => `<div class="card glass"><b>${r.libroTitulo}</b><br><small>Para: ${r.usuario}</small>
                    <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                        <input type="hidden" name="libroId" value="${r.libroId}">
                        <select name="estrellas"><option value="5">⭐⭐⭐⭐⭐</option><option value="1">⭐</option></select>
                        <button style="background:#e74c3c;">Devolver</button>
                    </form></div>`).join('')}
            </div>

            <div id="tor" class="section">
                ${req.session.rol === 'admin' ? `<div class="card glass"><b>Nuevo Torneo</b><form action="/admin/nuevo-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:${u.color};">Crear</button></form></div>` : ''}
                ${tors.map(t => `<div class="card glass">
                    ${req.session.rol === 'admin' ? `<form action="/admin/borrar-torneo/${t._id}" method="POST"><button class="del-btn">X</button></form>` : ''}
                    🏆 <b>${t.nombre}</b><br><small>${t.fecha}</small>
                </div>`).join('')}
            </div>

            <div id="adj" class="section">
                <div class="card glass" style="text-align:center;">
                    <div style="width:80px; height:80px; background:${u.color}; border-radius:50%; margin:0 auto 10px; display:flex; justify-content:center; align-items:center; border:3px solid white; overflow:hidden;">${avatar}</div>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto" accept="image/*"><input type="color" name="color" value="${u.color}"><button style="background:${u.color};">Guardar</button>
                    </form>
                    <a href="/salir" style="color:#ff7675; text-decoration:none; font-weight:bold; display:block; margin-top:10px;">Cerrar Sesión</a>
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

app.listen(PORT, () => console.log('Biblio V4.2 Glass & Admin ready'));
