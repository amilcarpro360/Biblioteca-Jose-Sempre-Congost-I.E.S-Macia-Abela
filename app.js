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
const upload = multer(); 
const MONGO_URI = "mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0"; 
mongoose.connect(MONGO_URI).then(() => console.log("Biblioteca PRO Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, genero: String, portada: String, reseñas: Array });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String, fecha: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: Array });
const Inscripcion = mongoose.model('Inscripcion', { nombre: String, apellidos: String, curso: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#2c3e50' } });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-mega-system', resave: false, saveUninitialized: false }));

// --- LÓGICA AUTH ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send(`Cuenta creada. <a href="/">Entrar</a>`);
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.u = u.user; req.session.rol = u.rol; res.redirect('/'); }
    else res.send('Error.');
});

// --- LÓGICA TORNEOS ---
app.post('/crear-torneo', async (req, res) => {
    if (req.session.rol === 'admin') await new Torneo({ ...req.body, participantes: [] }).save();
    res.redirect('/');
});

app.post('/unirse-torneo/:id', async (req, res) => {
    await Torneo.findByIdAndUpdate(req.params.id, { $addToSet: { participantes: req.session.u } });
    res.redirect('/');
});

// --- LÓGICA RESEÑAS Y DEVOLUCIÓN ---
app.post('/devolver/:id', async (req, res) => {
    const { estrellas, comentario, libroId } = req.body;
    const r = await Reserva.findById(req.params.id);
    if (r && (r.usuario === req.session.u || req.session.rol === 'admin')) {
        if (estrellas) {
            await Libro.findByIdAndUpdate(r.libroId, { 
                $push: { reseñas: { usuario: req.session.u, puntos: estrellas, texto: comentario || "" } } 
            });
        }
        await Reserva.findByIdAndDelete(req.params.id);
    }
    res.redirect('/');
});

// --- LÓGICA AJUSTES ---
app.post('/ajustes', async (req, res) => {
    await User.findOneAndUpdate({ user: req.session.u }, { color: req.body.color });
    res.redirect('/');
});

// Lógica básica de libros, reservas e inscripciones (se mantiene igual que antes)
app.post('/add-libro', upload.single('portada'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = "";
    if (req.file) {
        const r = await new Promise((resolve) => {
            let s = cloudinary.uploader.upload_stream({ folder: "biblio" }, (e, resu) => resolve(resu));
            streamifier.createReadStream(req.file.buffer).pipe(s);
        });
        img = r.secure_url;
    }
    await new Libro({ ...req.body, portada: img, reseñas: [] }).save();
    res.redirect('/');
});

app.post('/reservar', async (req, res) => {
    const l = await Libro.findById(req.body.libroId);
    await new Reserva({ usuario: req.session.u, curso: req.body.curso, libroId: l._id, libroTitulo: l.titulo, fecha: new Date().toLocaleDateString() }).save();
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    if (!req.session.u) return res.send(`<body style="font-family:sans-serif; background:#2c3e50; display:flex; justify-content:center; align-items:center; height:100vh;"><form action="/auth" method="POST" style="background:white; padding:30px; border-radius:15px; width:280px; text-align:center;"><h2>📖 Biblio Acceso</h2><input name="user" placeholder="Usuario" required style="width:100%; padding:10px; margin-bottom:10px;"><input name="pass" type="password" placeholder="Contraseña" required style="width:100%; padding:10px; margin-bottom:10px;"><input name="pin" placeholder="PIN Admin" style="width:100%; padding:10px; margin-bottom:15px;"><button name="accion" value="login" style="width:100%; background:#2c3e50; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer;">Entrar</button><button name="accion" value="registro" style="background:none; border:none; color:gray; margin-top:10px; cursor:pointer;">Registrarse</button></form></body>`);

    const userLog = await User.findOne({ user: req.session.u });
    const libros = await Libro.find();
    const reservas = await Reserva.find();
    const torneos = await Torneo.find();
    const esAdmin = req.session.rol === 'admin';
    const inicial = req.session.u.charAt(0).toUpperCase();

    res.send(`
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family:sans-serif; background:#f0f2f5; margin:0; padding-bottom: 80px; }
                header { background:${userLog.color}; color:white; padding:15px; text-align:center; position:sticky; top:0; z-index:100; }
                .tabs { display:flex; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
                .tab { flex:1; text-align:center; padding:15px; cursor:pointer; font-weight:bold; color:#666; }
                .tab.active { color:${userLog.color}; border-bottom:3px solid ${userLog.color}; }
                .container { max-width:600px; margin:20px auto; padding:0 15px; }
                .card { background:white; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
                input, select, button, textarea { width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; }
                .section { display:none; } .section.active { display:block; }
                .avatar-btn { position:fixed; bottom:20px; left:20px; width:55px; height:55px; background:${userLog.color}; color:white; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:24px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:200; border:3px solid white; }
                .portada { width:60px; height:90px; object-fit:cover; border-radius:5px; float:left; margin-right:15px; }
                .resreña { font-size:0.8em; background:#f9f9f9; padding:5px; margin-top:5px; border-radius:5px; }
            </style>
        </head>
        <body>
            <header><b>BIBLIOTECA & TORNEOS</b></header>
            <div class="tabs">
                <div class="tab active" onclick="ver('libros', this)">📚</div>
                <div class="tab" onclick="ver('prestamos', this)">🤝</div>
                <div class="tab" onclick="ver('torneos', this)">🏆</div>
            </div>

            <div class="avatar-btn" onclick="ver('ajustes', this)">${inicial}</div>

            <div class="container">
                <div id="sec-libros" class="section active">
                    ${esAdmin ? `<div class="card"><h4>Añadir Libro</h4><form action="/add-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título" required><input name="autor" placeholder="Autor"><input type="file" name="portada" required><button style="background:${userLog.color}; color:white;">Subir</button></form></div>` : ''}
                    ${libros.map(l => `
                        <div class="card">
                            <img src="${l.portada}" class="portada">
                            <b>${l.titulo}</b><br><small>${l.autor}</small><br>
                            <div style="margin-top:10px;">
                                <form action="/reservar" method="POST">
                                    <input type="hidden" name="libroId" value="${l._id}">
                                    <input name="curso" placeholder="Tu curso" required style="width:60%;">
                                    <button style="width:35%; background:#2ecc71; color:white;">Pedir</button>
                                </form>
                            </div>
                            <div style="clear:both; margin-top:10px;">
                                <details><summary style="font-size:0.8em; color:gray; cursor:pointer;">Ver Reseñas (${l.reseñas.length})</summary>
                                    ${l.reseñas.map(res => `<div class="resreña"><b>${res.usuario}:</b> ${"⭐".repeat(res.puntos)}<br>${res.texto}</div>`).join('')}
                                </details>
                            </div>
                        </div>`).join('')}
                </div>

                <div id="sec-prestamos" class="section">
                    ${reservas.filter(r => esAdmin || r.usuario === req.session.u).map(r => `
                        <div class="card">
                            <b>${r.libroTitulo}</b><br><small>Para: ${r.usuario} (${r.curso})</small>
                            <hr>
                            <form action="/devolver/${r._id}" method="POST">
                                <p style="margin:5px 0;">¿Cómo valoras el libro?</p>
                                <select name="estrellas">
                                    <option value="">No valorar</option>
                                    <option value="5">⭐⭐⭐⭐⭐ Excelente</option>
                                    <option value="4">⭐⭐⭐⭐ Muy bueno</option>
                                    <option value="3">⭐⭐⭐ Normal</option>
                                    <option value="2">⭐⭐ Malo</option>
                                    <option value="1">⭐ Pésimo</option>
                                </select>
                                <textarea name="comentario" placeholder="Comentario opcional..." style="height:60px;"></textarea>
                                <button style="background:#e74c3c; color:white;">Devolver y calificar</button>
                            </form>
                        </div>`).join('')}
                </div>

                <div id="sec-torneos" class="section">
                    ${esAdmin ? `<div class="card"><h4>Nuevo Torneo</h4><form action="/crear-torneo" method="POST"><input name="nombre" placeholder="Nombre Torneo"><input type="date" name="fecha"><button style="background:#f1c40f; color:black;">Abrir Torneo</button></form></div>` : ''}
                    ${torneos.map(t => `
                        <div class="card">
                            <h3 style="margin:0;">🏆 ${t.nombre}</h3>
                            <p>Fecha: ${t.fecha}</p>
                            <form action="/unirse-torneo/${t._id}" method="POST">
                                <button style="background:#3498db; color:white;">Inscribirse</button>
                            </form>
                            <small>Participantes (${t.participantes.length}): ${t.participantes.join(', ')}</small>
                        </div>`).join('')}
                </div>

                <div id="sec-ajustes" class="section">
                    <div class="card" style="text-align:center;">
                        <div style="width:80px; height:80px; background:${userLog.color}; border-radius:50%; margin:0 auto 15px; display:flex; justify-content:center; align-items:center; font-size:35px; color:white; border:4px solid #eee;">${inicial}</div>
                        <h3>Hola, ${req.session.u}</h3>
                        <p>Rol: ${req.session.rol}</p>
                        <form action="/ajustes" method="POST">
                            <label>Cambiar Color Perfil:</label>
                            <input type="color" name="color" value="${userLog.color}" style="height:50px;">
                            <button style="background:#2c3e50; color:white;">Guardar Ajustes</button>
                        </form>
                        <a href="/salir" style="color:red; text-decoration:none; font-weight:bold;">Cerrar Sesión</a>
                    </div>
                </div>
            </div>

            <script>
                function ver(id, el) {
                    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.getElementById('sec-' + id).classList.add('active');
                    if(el.classList.contains('tab')) el.classList.add('active');
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log('Biblioteca Pro lista'));
