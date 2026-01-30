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

mongoose.connect("mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0").then(() => console.log("Sección Noticias Pro Lista"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, portada: String, reseñas: { type: Array, default: [] } });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, libroId: String, libroTitulo: String });
const Torneo = mongoose.model('Torneo', { nombre: String, fecha: String });
const Novedad = mongoose.model('Novedad', { titulo: String, texto: String, imagen: String, fecha: String, autor: { type: String, default: "Admin" } });
const User = mongoose.model('User', { user: String, pass: String, rol: String, color: { type: String, default: '#3498db' }, foto: { type: String, default: "" } });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'news-pro-2026', resave: false, saveUninitialized: false }));

const subirImagen = (buffer) => new Promise((resolve) => {
    const s = cloudinary.uploader.upload_stream({ folder: "biblioteca_v4" }, (err, res) => resolve(res ? res.secure_url : ""));
    streamifier.createReadStream(buffer).pipe(s);
});

// --- RUTAS DE ADMINISTRACIÓN ---
app.post('/admin/novedad', upload.single('imagen'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = req.file ? await subirImagen(req.file.buffer) : "";
    await new Novedad({ 
        titulo: req.body.titulo, 
        texto: req.body.texto, 
        imagen: img, 
        fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        autor: req.session.u
    }).save();
    res.redirect('/');
});

app.post('/admin/borrar-novedad/:id', async (req, res) => {
    if (req.session.rol === 'admin') await Novedad.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

// ... (Resto de rutas de auth, libros y torneos se mantienen iguales)

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ GLASS ---
app.get('/', async (req, res) => {
    if (!req.session.uid) return res.send(`
        <style>
            body { margin:0; font-family:sans-serif; background: linear-gradient(135deg, #1e2a38, #000); height:100vh; display:flex; justify-content:center; align-items:center; color:white; }
            .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding:40px; width:300px; text-align:center; }
            input { width:100%; padding:12px; margin:10px 0; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:white; outline:none; }
            button { width:100%; padding:12px; border-radius:10px; border:none; background:#3498db; color:white; font-weight:bold; cursor:pointer; }
        </style>
        <div class="glass">
            <img src="TU_LOGO_AQUI" style="width:70px; margin-bottom:20px;">
            <h2>Biblio Login</h2>
            <form action="/auth" method="POST">
                <input name="user" placeholder="Usuario" required>
                <input name="pass" type="password" placeholder="Contraseña" required>
                <button name="accion" value="login">Entrar</button>
            </form>
        </div>
    `);

    const u = await User.findById(req.session.uid);
    const novs = await Novedad.find().sort({ _id: -1 });
    const avatar = u.foto ? `<img src="${u.foto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%">` : u.user[0].toUpperCase();

    res.send(`
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { margin:0; font-family:sans-serif; background: #0f172a; color:white; background-attachment: fixed; }
            .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; }
            .nav { position:fixed; top:0; width:100%; z-index:1000; padding:15px; text-align:center; font-weight:bold; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.1); }
            .tabs { position:fixed; top:55px; width:100%; display:flex; z-index:1000; justify-content:center; gap:10px; padding:10px 0; }
            .tab { padding:8px 16px; border-radius:12px; cursor:pointer; font-size:0.85em; transition: 0.3s; }
            .tab.active { background: ${u.color}; color: white; box-shadow: 0 4px 15px ${u.color}66; }
            .container { max-width:480px; margin:130px auto 40px; padding:0 20px; }
            
            /* ESTILO NOTICIAS TIPO RED SOCIAL */
            .news-card { margin-bottom:25px; overflow:hidden; }
            .news-header { padding:15px; display:flex; align-items:center; gap:12px; }
            .news-avatar { width:40px; height:40px; border-radius:50%; background:${u.color}; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:0.9em; }
            .news-info b { display:block; font-size:0.95em; }
            .news-info span { font-size:0.75em; opacity:0.5; }
            .news-body { padding:0 15px 15px; }
            .news-body h3 { margin:0 0 8px; font-size:1.1em; color:${u.color}; }
            .news-body p { margin:0; font-size:0.9em; line-height:1.5; opacity:0.8; }
            .news-img { width:100%; display:block; border-top: 1px solid rgba(255,255,255,0.05); }
            
            .admin-panel { padding:20px; margin-bottom:30px; border: 1px dashed rgba(255,255,255,0.2); }
            .btn-user { position:fixed; bottom:25px; left:25px; width:55px; height:55px; border-radius:50%; z-index:1500; border:2px solid white; overflow:hidden; background:${u.color}; }
            .del-x { float:right; background:none; color:#ff7675; border:none; cursor:pointer; font-weight:bold; }
            input, textarea, button { width:100%; padding:12px; margin-top:10px; border-radius:12px; border:none; background:rgba(255,255,255,0.05); color:white; outline:none; font-family:inherit; }
            button { background:${u.color}; font-weight:bold; }
        </style>
    </head>
    <body>
        <div class="nav">BIBLIOTECA MASTER</div>
        <div class="tabs">
            <div class="tab active" onclick="ver('nov', this)">Noticias</div>
            <div class="tab glass" onclick="ver('lib', this)">Libros</div>
            <div class="tab glass" onclick="ver('pre', this)">Préstamos</div>
            <div class="tab glass" onclick="ver('tor', this)">Torneos</div>
        </div>

        <div class="btn-user" onclick="ver('adj', this)">${avatar}</div>

        <div class="container">
            <div id="nov" class="section active-sec">
                ${req.session.rol === 'admin' ? `
                <div class="glass admin-panel">
                    <b style="color:${u.color}">📢 Nueva Noticia</b>
                    <form action="/admin/novedad" method="POST" enctype="multipart/form-data">
                        <input name="titulo" placeholder="Título impactante" required>
                        <textarea name="texto" placeholder="¿Qué está pasando?" rows="3"></textarea>
                        <input type="file" name="imagen" accept="image/*">
                        <button>Lanzar Noticia</button>
                    </form>
                </div>` : ''}

                ${novs.map(n => `
                <div class="glass news-card">
                    <div class="news-header">
                        <div class="news-avatar">${n.autor[0].toUpperCase()}</div>
                        <div class="news-info">
                            <b>${n.autor}</b>
                            <span>${n.fecha}</span>
                        </div>
                        ${req.session.rol === 'admin' ? `<form action="/admin/borrar-novedad/${n._id}" method="POST" style="margin-left:auto;"><button class="del-x">×</button></form>` : ''}
                    </div>
                    <div class="news-body">
                        <h3>${n.titulo}</h3>
                        <p>${n.texto}</p>
                    </div>
                    ${n.imagen ? `<img src="${n.imagen}" class="news-img">` : ''}
                </div>`).join('')}
            </div>

            <div id="lib" class="section" style="display:none"> ... </div>
            <div id="pre" class="section" style="display:none"> ... </div>
            <div id="tor" class="section" style="display:none"> ... </div>
            <div id="adj" class="section" style="display:none"> ... </div>
        </div>

        <script>
            function ver(id, el) {
                document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).style.display = 'block';
                el.classList.add('active');
            }
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => console.log('Sección Noticias Glass Pro activada'));
