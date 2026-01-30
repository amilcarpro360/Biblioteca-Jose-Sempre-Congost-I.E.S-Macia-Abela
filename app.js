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
mongoose.connect(MONGO_URI).then(() => console.log("Biblioteca Master Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, genero: String, portada: String, reseñas: Array });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String, fecha: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: Array });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#2c3e50' }, foto: String });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-ultra-system', resave: false, saveUninitialized: false }));

// --- HELPER PARA CLOUDINARY ---
const subirANube = (buffer) => {
    return new Promise((resolve) => {
        let s = cloudinary.uploader.upload_stream({ folder: "biblio_pro" }, (e, resu) => resolve(resu));
        streamifier.createReadStream(buffer).pipe(s);
    });
};

// --- LÓGICA AUTH ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol, foto: "" }).save();
        return res.send(`Cuenta creada. <a href="/">Entrar</a>`);
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.u = u.user; req.session.rol = u.rol; res.redirect('/'); }
    else res.send('Error de login.');
});

// --- MODO EDICIÓN / BORRADO (ADMIN) ---
app.post('/admin/:accion/:tipo/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    const { accion, tipo, id } = req.params;

    if (accion === 'borrar') {
        if (tipo === 'libro') await Libro.findByIdAndDelete(id);
        if (tipo === 'torneo') await Torneo.findByIdAndDelete(id);
    } 
    else if (accion === 'editar') {
        if (tipo === 'libro') await Libro.findByIdAndUpdate(id, { titulo: req.body.titulo, autor: req.body.autor });
        if (tipo === 'torneo') await Torneo.findByIdAndUpdate(id, { nombre: req.body.nombre, fecha: req.body.fecha });
    }
    res.redirect('/');
});

// Borrar concursante específico
app.post('/admin/quitar-concursante/:torneoId', async (req, res) => {
    if (req.session.rol === 'admin') {
        await Torneo.findByIdAndUpdate(req.params.torneoId, { $pull: { participantes: req.body.usuario } });
    }
    res.redirect('/');
});

// --- LÓGICA USUARIO Y FOTO ---
app.post('/ajustes', upload.single('nuevaFoto'), async (req, res) => {
    let updateData = { color: req.body.color };
    if (req.file) {
        const result = await subirANube(req.file.buffer);
        updateData.foto = result.secure_url;
    }
    await User.findOneAndUpdate({ user: req.session.u }, updateData);
    res.redirect('/');
});

// --- TORNEOS, LIBROS Y RESERVAS ---
app.post('/crear-torneo', async (req, res) => {
    if (req.session.rol === 'admin') await new Torneo({ ...req.body, participantes: [] }).save();
    res.redirect('/');
});

app.post('/unirse-torneo/:id', async (req, res) => {
    await Torneo.findByIdAndUpdate(req.params.id, { $addToSet: { participantes: req.session.u } });
    res.redirect('/');
});

app.post('/add-libro', upload.single('portada'), async (req, res) => {
    let img = "";
    if (req.file) {
        const r = await subirANube(req.file.buffer);
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

app.post('/devolver/:id', async (req, res) => {
    const r = await Reserva.findById(req.params.id);
    if (r && (r.usuario === req.session.u || req.session.rol === 'admin')) {
        if (req.body.estrellas) {
            await Libro.findByIdAndUpdate(r.libroId, { 
                $push: { reseñas: { usuario: req.session.u, puntos: req.body.estrellas, texto: req.body.comentario || "" } } 
            });
        }
        await Reserva.findByIdAndDelete(req.params.id);
    }
    res.redirect('/');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    if (!req.session.u) return res.send(`<body style="font-family:sans-serif; background:#2c3e50; display:flex; justify-content:center; align-items:center; height:100vh;"><form action="/auth" method="POST" style="background:white; padding:30px; border-radius:15px; width:280px; text-align:center;"><h2>📖 Biblio v2</h2><input name="user" placeholder="Usuario" required style="width:100%; padding:10px; margin-bottom:10px;"><input name="pass" type="password" placeholder="Contraseña" required style="width:100%; padding:10px; margin-bottom:10px;"><input name="pin" placeholder="PIN Admin" style="width:100%; padding:10px; margin-bottom:15px;"><button name="accion" value="login" style="width:100%; background:#2c3e50; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer;">Entrar</button><button name="accion" value="registro" style="background:none; border:none; color:gray; margin-top:10px; cursor:pointer;">Registrarse</button></form></body>`);

    const userLog = await User.findOne({ user: req.session.u });
    const libros = await Libro.find();
    const reservas = await Reserva.find();
    const torneos = await Torneo.find();
    const esAdmin = req.session.rol === 'admin';
    
    // Imagen de perfil: si tiene foto la usa, si no, la inicial
    const avatarContent = userLog.foto ? `<img src="${userLog.foto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : req.session.u.charAt(0).toUpperCase();

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
                .card { background:white; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.06); position:relative; }
                input, select, button, textarea { width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; }
                .section { display:none; } .section.active { display:block; }
                .avatar-btn { position:fixed; bottom:20px; left:20px; width:60px; height:60px; background:${userLog.color}; color:white; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:24px; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:200; border:3px solid white; overflow:hidden; }
                .portada { width:60px; height:90px; object-fit:cover; border-radius:5px; float:left; margin-right:15px; }
                .btn-edit { background:#3498db; color:white; border:none; padding:5px; border-radius:5px; font-size:0.7em; cursor:pointer; margin-right:5px; }
                .btn-del { background:#ff7675; color:white; border:none; padding:5px; border-radius:5px; font-size:0.7em; cursor:pointer; }
            </style>
        </head>
        <body>
            <header><b>GESTIÓN BIBLIOTECA</b></header>
            <div class="tabs">
                <div class="tab active" onclick="ver('libros', this)">📚</div>
                <div class="tab" onclick="ver('prestamos', this)">🤝</div>
                <div class="tab" onclick="ver('torneos', this)">🏆</div>
            </div>

            <div class="avatar-btn" onclick="ver('ajustes', this)">${avatarContent}</div>

            <div class="container">
                <div id="sec-libros" class="section active">
                    ${esAdmin ? `<div class="card"><h4>Nuevo Libro</h4><form action="/add-libro" method="POST" enctype="multipart/form-data"><input name="titulo" placeholder="Título"><input name="autor" placeholder="Autor"><input type="file" name="portada" required><button style="background:${userLog.color}; color:white;">Añadir</button></form></div>` : ''}
                    ${libros.map(l => `
                        <div class="card">
                            <img src="${l.portada}" class="portada">
                            <b>${l.titulo}</b><br><small>${l.autor}</small>
                            ${esAdmin ? `
                                <div style="margin-top:10px;">
                                    <details><summary class="btn-edit" style="display:inline-block; width:auto;">Editar Libro</summary>
                                        <form action="/admin/editar/libro/${l._id}" method="POST" style="margin-top:10px;">
                                            <input name="titulo" value="${l.titulo}">
                                            <input name="autor" value="${l.autor}">
                                            <button style="background:#2ecc71; color:white;">Guardar Cambios</button>
                                        </form>
                                        <form action="/admin/borrar/libro/${l._id}" method="POST">
                                            <button class="btn-del" style="width:100%;">Eliminar permanentemente</button>
                                        </form>
                                    </details>
                                </div>
                            ` : ''}
                            <form action="/reservar" method="POST" style="margin-top:10px; clear:both;">
                                <input type="hidden" name="libroId" value="${l._id}">
                                <input name="curso" placeholder="Curso" required style="width:60%;">
                                <button style="width:35%; background:#2ecc71; color:white;">Pedir</button>
                            </form>
                        </div>`).join('')}
                </div>

                <div id="sec-torneos" class="section">
                    ${esAdmin ? `<div class="card"><h4>Crear Torneo</h4><form action="/crear-torneo" method="POST"><input name="nombre" placeholder="Nombre"><input type="date" name="fecha"><button style="background:#f1c40f;">Publicar</button></form></div>` : ''}
                    ${torneos.map(t => `
                        <div class="card">
                            <h3>🏆 ${t.nombre}</h3>
                            <p>Fecha: ${t.fecha}</p>
                            ${esAdmin ? `
                                <details><summary class="btn-edit" style="display:inline-block; width:auto; margin-bottom:10px;">Gestionar Torneo</summary>
                                    <form action="/admin/editar/torneo/${t._id}" method="POST">
                                        <input name="nombre" value="${t.nombre}">
                                        <input type="date" name="fecha" value="${t.fecha}">
                                        <button style="background:#2ecc71; color:white;">Actualizar Info</button>
                                    </form>
                                    <h5>Participantes:</h5>
                                    ${t.participantes.map(p => `
                                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                            <span>👤 ${p}</span>
                                            <form action="/admin/quitar-concursante/${t._id}" method="POST" style="margin:0;">
                                                <input type="hidden" name="usuario" value="${p}">
                                                <button class="btn-del">Quitar</button>
                                            </form>
                                        </div>`).join('')}
                                    <form action="/admin/borrar/torneo/${t._id}" method="POST">
                                        <button class="btn-del" style="width:100%; margin-top:10px;">Borrar Torneo Completo</button>
                                    </form>
                                </details>
                            ` : ''}
                            <form action="/unirse-torneo/${t._id}" method="POST">
                                <button style="background:#3498db; color:white;">Inscribirse</button>
                            </form>
                        </div>`).join('')}
                </div>

                <div id="sec-ajustes" class="section">
                    <div class="card" style="text-align:center;">
                        <div style="width:100px; height:100px; background:${userLog.color}; border-radius:50%; margin:0 auto 15px; display:flex; justify-content:center; align-items:center; font-size:40px; color:white; border:4px solid white; box-shadow:0 2px 10px rgba(0,0,0,0.1); overflow:hidden;">
                            ${avatarContent}
                        </div>
                        <h3>Perfil de ${req.session.u}</h3>
                        <form action="/ajustes" method="POST" enctype="multipart/form-data">
                            <label>Cambiar foto de perfil:</label>
                            <input type="file" name="nuevaFoto">
                            <label>Color de tema:</label>
                            <input type="color" name="color" value="${userLog.color}">
                            <button style="background:${userLog.color}; color:white;">Guardar Cambios</button>
                        </form>
                        <hr><a href="/salir" style="color:red; text-decoration:none;">Cerrar Sesión</a>
                    </div>
                </div>

                <div id="sec-prestamos" class="section">
                    ${reservas.filter(r => esAdmin || r.usuario === req.session.u).map(r => `
                        <div class="card">
                            <b>${r.libroTitulo}</b><br><small>Alumno: ${r.usuario}</small>
                            <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                                <select name="estrellas"><option value="">Sin nota</option><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option></select>
                                <textarea name="comentario" placeholder="Comentario opcional..."></textarea>
                                <button style="background:#e74c3c; color:white;">Devolver</button>
                            </form>
                        </div>`).join('')}
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

app.listen(PORT, () => console.log('Biblioteca Modo Edición Lista'));

