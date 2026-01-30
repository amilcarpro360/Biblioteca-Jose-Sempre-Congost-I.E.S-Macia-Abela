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
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') ? cb(null, true) : cb(null, false);
    }
});

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Sistema Pro Conectado"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: Array });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String, participantes: Array });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String });
const User = mongoose.model('User', { 
    user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, 
    foto: String, carnet: Object 
});

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-v4-super', resave: false, saveUninitialized: false }));

// --- HELPERS ---
const subirImagen = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send('<body style="background:#2c3e50;color:white;font-family:sans-serif;text-align:center;padding-top:50px;"><h2>✅ ¡Cuenta Creada!</h2><a href="/" style="color:white;">Volver al inicio</a></body>');
    }
    const u = await User.findOne({ user, pass });
    if (u) { req.session.uid = u._id; req.session.rol = u.rol; res.redirect('/'); }
    else res.send('Error de acceso.');
});

app.post('/admin/novedad', upload.single('imagen'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImagen(req.file.buffer) : "";
    await new Novedad({ ...req.body, imagen: img, fecha: new Date().toLocaleDateString() }).save();
    res.redirect('/');
});

// ... (Resto de rutas: /reservar, /devolver, /ajustes, /admin/nuevo-libro, /admin/nuevo-torneo se mantienen igual que la versión anterior)

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    // LOGIN CURRADO
    if (!req.session.uid) return res.send(`
    <style>
        body { margin:0; font-family:sans-serif; background:linear-gradient(135deg, #2c3e50, #000); height:100vh; display:flex; justify-content:center; align-items:center; color:white; }
        .login-card { background:rgba(255,255,255,0.1); backdrop-filter:blur(10px); padding:40px; border-radius:20px; box-shadow:0 15px 35px rgba(0,0,0,0.5); width:320px; border:1px solid rgba(255,255,255,0.1); text-align:center; animation: fadeIn 1s ease; }
        input { width:100%; padding:12px; margin:10px 0; border-radius:10px; border:none; background:rgba(255,255,255,0.2); color:white; outline:none; }
        input::placeholder { color:#ccc; }
        button { width:100%; padding:12px; border-radius:10px; border:none; background:#3498db; color:white; font-weight:bold; cursor:pointer; margin-top:10px; }
        .reg { background:none; font-size:0.8em; color:#aaa; margin-top:15px; cursor:pointer; }
        @keyframes fadeIn { from {opacity:0; transform:translateY(20px);} to {opacity:1; transform:translateY(0);} }
    </style>
    <div class="login-card">
        <img src="URL_DE_TU_LOGO_AQUI" style="width:80px; margin-bottom:10px;">
        <h2>Biblio System</h2>
        <form action="/auth" method="POST">
            <input name="user" placeholder="Usuario" required>
            <input name="pass" type="password" placeholder="Contraseña" required>
            <input name="pin" placeholder="PIN Admin (Opcional)">
            <button name="accion" value="login">Iniciar Sesión</button>
            <button name="accion" value="registro" class="reg">¿No tienes cuenta? Regístrate</button>
        </form>
    </div>`);

    const u = await User.findById(req.session.uid);
    const libros = await Libro.find();
    const reservas = await Reserva.find(req.session.rol === 'admin' ? {} : { usuario: u.user });
    const novedades = await Novedad.find().sort({ _id: -1 });
    const torneos = await Torneo.find();
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* ANIMACION DE INICIO (SPLASH) */
            #splash { position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:1000; display:flex; justify-content:center; align-items:center; animation: fadeOut 2s forwards; animation-delay: 1.5s; }
            @keyframes fadeOut { to { opacity:0; visibility:hidden; } }
            
            body { font-family:sans-serif; background:#f4f7f6; margin:0; padding-bottom:80px; }
            .nav { background:${u.color}; color:white; padding:15px; text-align:center; position:sticky; top:0; z-index:500; }
            .tabs { display:flex; background:white; position:sticky; top:46px; z-index:490; box-shadow:0 2px 5px rgba(0,0,0,0.1); overflow-x:auto; }
            .tab { flex:none; width:100px; padding:12px; text-align:center; cursor:pointer; font-weight:bold; color:#888; }
            .tab.active { color:${u.color}; border-bottom:3px solid ${u.color}; }
            .container { max-width:500px; margin:20px auto; padding:0 15px; }
            .card { background:white; padding:15px; border-radius:15px; margin-bottom:15px; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
            .btn-user { position:fixed; bottom:20px; left:20px; width:60px; height:60px; background:${u.color}; border-radius:50%; border:3px solid white; color:white; display:flex; justify-content:center; align-items:center; font-size:22px; cursor:pointer; z-index:600; overflow:hidden; }
            .section { display:none; margin-top:60px; } .active-sec { display:block; }
            .nov-img { width:100%; height:200px; object-fit:cover; border-radius:10px; margin-bottom:10px; }
        </style>
    </head>
    <body>
        <div id="splash">
            <img src="URL_DE_TU_LOGO_AQUI" style="width:150px; animation: pulse 1.5s infinite;">
        </div>
        <style> @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.1);} 100%{transform:scale(1);} } </style>

        <div class="nav"><b>BIBLIOTECA MASTER</b></div>
        <div class="tabs">
            <div class="tab active" onclick="switchTab('nov', this)">📢 Novs</div>
            <div class="tab" onclick="switchTab('lib', this)">📚 Libros</div>
            <div class="tab" onclick="switchTab('pre', this)">🤝 Prest.</div>
            <div class="tab" onclick="switchTab('tor', this)">🏆 Torneos</div>
        </div>

        <div class="btn-user" onclick="switchTab('adj', this)">${avatar}</div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `
                    <div class="card">
                        <b>Publicar Novedad</b>
                        <form action="/admin/novedad" method="POST" enctype="multipart/form-data">
                            <input name="titulo" placeholder="Título del aviso" required>
                            <textarea name="texto" placeholder="Escribe la noticia..." style="width:100%; padding:10px; border-radius:10px; border:1px solid #ddd;"></textarea>
                            <input type="file" name="imagen" accept="image/*">
                            <button style="background:${u.color}; color:white; border:none; padding:10px; border-radius:8px;">Publicar</button>
                        </form>
                    </div>` : ''}
                ${novedades.map(n => `
                    <div class="card">
                        ${n.imagen ? `<img src="${n.imagen}" class="nov-img">` : ''}
                        <h3 style="margin:0;">${n.titulo}</h3>
                        <p style="color:#555; font-size:0.9em;">${n.texto}</p>
                        <small style="color:#999;">${n.fecha}</small>
                    </div>`).join('')}
            </div>

            <div id="lib" class="section">
                 <p style="text-align:center;">Sección de libros cargada.</p>
            </div>
            
            <div id="pre" class="section">
                <p style="text-align:center;">Sección de préstamos cargada.</p>
            </div>

            <div id="tor" class="section">
                <p style="text-align:center;">Sección de torneos cargada.</p>
            </div>

            <div id="adj" class="section">
                <div class="card" style="text-align:center;">
                    <div style="width:80px; height:80px; background:${u.color}; border-radius:50%; margin:0 auto 10px; display:flex; justify-content:center; align-items:center; color:white; font-size:30px; border:4px solid #eee; overflow:hidden;">${avatar}</div>
                    <form action="/ajustes" method="POST" enctype="multipart/form-data">
                        <input type="file" name="foto" accept="image/*">
                        <input type="color" name="color" value="${u.color}">
                        <button style="background:${u.color}; color:white; border:none; padding:10px; border-radius:10px;">Guardar Cambios</button>
                    </form>
                    <a href="/salir" style="color:red; text-decoration:none; font-weight:bold;">Cerrar Sesión</a>
                </div>
            </div>
        </div>

        <script>
            function switchTab(id, el) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active-sec'));
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active-sec');
                if(el) el.classList.add('active');
            }
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Servidor con Splash y Login Pro listo'));
