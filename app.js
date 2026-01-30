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
  api_secret: 'TU_API_SECRET_AQUÍ' 
});
const upload = multer(); 
const MONGO_URI = "TU_LINK_DE_MONGODB_AQUÍ"; 
mongoose.connect(MONGO_URI).then(() => console.log("Biblioteca Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', {
    titulo: String, autor: String, genero: String, portada: String
});

const Reserva = mongoose.model('Reserva', {
    nombreAlumno: String, curso: String, fechaPrestamo: String, 
    libroTitulo: String, passDevolucion: String
});

const Inscripcion = mongoose.model('Inscripcion', {
    nombre: String, apellidos: String, curso: String, fecha: String
});

const Admin = mongoose.model('Admin', { user: String, pass: String });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-secret', resave: false, saveUninitialized: false }));

// --- LÓGICA DE ADMIN ---
app.post('/auth-admin', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro' && pin === '2845') {
        await new Admin({ user, pass }).save();
        return res.send('Admin creado. <a href="/">Volver</a>');
    }
    const a = await Admin.findOne({ user, pass });
    if (a) { req.session.admin = a.user; res.redirect('/'); }
    else res.send('Error de Admin.');
});

// --- LÓGICA DE LIBROS ---
app.post('/add-libro', upload.single('portada'), async (req, res) => {
    if (!req.session.admin) return res.send('No autorizado');
    let img = "";
    if (req.file) {
        const r = await new Promise((res) => {
            let s = cloudinary.uploader.upload_stream({ folder: "biblio_libros" }, (e, resu) => res(resu));
            streamifier.createReadStream(req.file.buffer).pipe(s);
        });
        img = r.secure_url;
    }
    await new Libro({ ...req.body, portada: img }).save();
    res.redirect('/');
});

// --- LÓGICA DE RESERVAS ---
app.post('/reservar', async (req, res) => {
    await new Reserva(req.body).save();
    res.send('Reserva confirmada. ¡No olvides tu contraseña para devolverlo! <a href="/">Volver</a>');
});

app.post('/devolver/:id', async (req, res) => {
    const r = await Reserva.findById(req.params.id);
    if (r && r.passDevolucion === req.body.passCheck) {
        await Reserva.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } else {
        res.send('Contraseña de devolución incorrecta. <a href="/">Volver</a>');
    }
});

// --- LÓGICA DE INSCRIPCIÓN ---
app.post('/inscribirse', async (req, res) => {
    await new Inscripcion({ ...req.body, fecha: new Date().toLocaleDateString() }).save();
    res.send('Datos enviados. El bibliotecario te avisará cuando tu carnet esté listo. <a href="/">Volver</a>');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const libros = await Libro.find();
    const reservas = await Reserva.find();
    const inscritos = req.session.admin ? await Inscripcion.find() : [];
    
    res.send(`
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family:sans-serif; background:#f5f5f5; margin:0; }
                header { background:#2c3e50; color:white; padding:20px; text-align:center; }
                .tabs { display:flex; background:white; position:sticky; top:0; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
                .tab { flex:1; text-align:center; padding:15px; cursor:pointer; font-weight:bold; color:#555; }
                .tab.active { color:#e67e22; border-bottom:3px solid #e67e22; }
                .container { max-width:600px; margin:20px auto; padding:0 15px; }
                .section { display:none; } .section.active { display:block; }
                .card { background:white; padding:15px; border-radius:10px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
                input, select, button { width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:1px solid #ddd; }
                img { width:100px; height:140px; object-fit:cover; border-radius:5px; float:left; margin-right:15px; }
            </style>
        </head>
        <body>
            <header>
                <h1>📚 Biblioteca Escolar</h1>
                ${req.session.admin ? `<span>Admin: ${req.session.admin} | <a href="/salir" style="color:white;">Salir</a></span>` : '<small>Acceso Público</small>'}
            </header>

            <div class="tabs">
                <div class="tab active" onclick="ver('libros', this)">Libros</div>
                <div class="tab" onclick="ver('reservas', this)">Reservas</div>
                <div class="tab" onclick="ver('inscripcion', this)">Carnet</div>
                <div class="tab" onclick="ver('admin', this)">🔑</div>
            </div>

            <div class="container">
                <div id="sec-libros" class="section active">
                    ${req.session.admin ? `
                        <div class="card" style="border:2px solid #e67e22;">
                            <h3>Añadir Libro</h3>
                            <form action="/add-libro" method="POST" enctype="multipart/form-data">
                                <input name="titulo" placeholder="Título" required>
                                <input name="autor" placeholder="Autor" required>
                                <select name="genero">
                                    <option value="Aventura">Aventura</option>
                                    <option value="Fantasía">Fantasía</option>
                                    <option value="Historia">Historia</option>
                                    <option value="Ciencia">Ciencia</option>
                                </select>
                                <input type="file" name="portada" required>
                                <button style="background:#e67e22; color:white; border:none;">Subir Libro</button>
                            </form>
                        </div>
                    ` : ''}
                    
                    <h3>Catálogo</h3>
                    ${libros.map(l => `
                        <div class="card" style="overflow:hidden;">
                            <img src="${l.portada}">
                            <b>${l.titulo}</b><br><small>${l.autor}</small><br>
                            <span style="font-size:0.8em; color:gray;">Género: ${l.genero}</span>
                        </div>
                    `).join('')}
                </div>

                <div id="sec-reservas" class="section">
                    <div class="card">
                        <h3>Nueva Reserva</h3>
                        <form action="/reservar" method="POST">
                            <input name="nombreAlumno" placeholder="Tu Nombre" required>
                            <input name="curso" placeholder="Curso (Ej: 3ºB)" required>
                            <select name="libroTitulo">
                                ${libros.map(l => `<option value="${l.titulo}">${l.titulo}</option>`).join('')}
                            </select>
                            <input type="date" name="fechaPrestamo" required>
                            <input type="password" name="passDevolucion" placeholder="Contraseña para devolver" required>
                            <button style="background:#2ecc71; color:white; border:none;">Confirmar Préstamo</button>
                        </form>
                    </div>

                    <h3>Libros Prestados</h3>
                    ${reservas.map(r => `
                        <div class="card">
                            <b>${r.libroTitulo}</b><br>
                            Llevado por: ${r.nombreAlumno} (${r.curso})<br>
                            <small>Desde: ${r.fechaPrestamo}</small>
                            <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                                <input type="password" name="passCheck" placeholder="Pass para devolver" required style="width:60%; padding:5px;">
                                <button style="width:35%; background:#e74c3c; color:white; border:none; padding:5px;">Devolver</button>
                            </form>
                        </div>
                    `).join('')}
                </div>

                <div id="sec-inscripcion" class="section">
                    <div class="card">
                        <h3>Solicitar Carnet</h3>
                        <form action="/inscribirse" method="POST">
                            <input name="nombre" placeholder="Nombre" required>
                            <input name="apellidos" placeholder="Apellidos" required>
                            <input name="curso" placeholder="Curso" required>
                            <button style="background:#3498db; color:white; border:none;">Enviar Datos</button>
                        </form>
                    </div>
                    ${req.session.admin ? `
                        <h3>Lista para Carnets</h3>
                        ${inscritos.map(i => `<div class="card">${i.nombre} ${i.apellidos} - <b>${i.curso}</b></div>`).join('')}
                    ` : ''}
                </div>

                <div id="sec-admin" class="section">
                    <div class="card">
                        <h3>Acceso Bibliotecario</h3>
                        <form action="/auth-admin" method="POST">
                            <input name="user" placeholder="Usuario" required>
                            <input name="pass" type="password" placeholder="Contraseña" required>
                            <input name="pin" placeholder="PIN Secreto (solo registro)">
                            <button name="accion" value="login">Entrar</button>
                            <button name="accion" value="registro" style="background:none; border:none; color:gray;">Registrar Admin</button>
                        </form>
                    </div>
                </div>
            </div>

            <script>
                function ver(id, el) {
                    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.getElementById('sec-' + id).classList.add('active');
                    el.classList.add('active');
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log('Biblioteca Lista'));