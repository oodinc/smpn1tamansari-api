import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from 'url';

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;
const prisma = new PrismaClient();

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(err => cb(err, null));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Function to generate public URL for local file
const getLocalFileUrl = (filename) => {
  return `/uploads/${filename}`;
};

// Function to delete local file
const deleteLocalFile = async (filePath) => {
  try {
    // Convert URL to file path if needed
    const fullPath = path.join(__dirname, filePath.replace(/^\//, ''));
    await fs.unlink(fullPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error("Error deleting local file:", error);
      throw new Error("Failed to delete local file");
    }
  }
};

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);

    // Check token expiration
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(403).json({ error: "Token expired, please log in again" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};

app.get("/api/admin/secure-data", authenticateToken, async (req, res) => {
  res.json({ message: "This is secured data for admin" });
});

// Login admin
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ id: admin.id }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "An error occurred during login" });
  }
});

// Endpoint to ensure server is running
app.get("/", (req, res) => {
  res.send("Backend server is running");
});

// Get all news
app.get("/api/news", async (req, res) => {
  const news = await prisma.news.findMany();
  res.json(news);
});

// Get news by ID
app.get("/api/news/:id", async (req, res) => {
  const { id } = req.params;
  const newsItem = await prisma.news.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(newsItem);
});

// Add news with image upload
app.post("/api/news", upload.single("image"), async (req, res) => {
  const { title, description, publishedAt } = req.body;

  try {
    const image = req.file 
      ? getLocalFileUrl(req.file.filename) 
      : null;

    const newNews = await prisma.news.create({
      data: {
        title,
        description,
        image,
        publishedAt: new Date(publishedAt),
      },
    });
    res.json(newNews);
  } catch (error) {
    console.error("Error creating news:", error);
    res
      .status(500)
      .json({ error: "Failed to create news", details: error.message });
  }
});

// Endpoint to update news with image upload
app.put("/api/news/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description, publishedAt } = req.body;

  try {
    // Fetch existing news
    const existingNews = await prisma.news.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNews) {
      return res.status(404).json({ error: "News not found" });
    }

    // If new file is uploaded, handle image update
    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);

      // Delete old image file if it exists
      if (existingNews.image) {
        await deleteLocalFile(existingNews.image);
      }
    }

    // Update news data
    const updatedNews = await prisma.news.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        image: newImage || existingNews.image,
        publishedAt: new Date(publishedAt),
      },
    });
    res.json(updatedNews);
  } catch (error) {
    console.error("Error updating news:", error);
    res
      .status(500)
      .json({ error: "Failed to update news", details: error.message });
  }
});

// Delete news by ID
app.delete("/api/news/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch existing news
    const existingNews = await prisma.news.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNews) {
      return res.status(404).json({ error: "News not found" });
    }

    // Delete associated image file if it exists
    if (existingNews.image) {
      await deleteLocalFile(existingNews.image);
    }

    // Delete news from database
    await prisma.news.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting news:", error);
    res
      .status(500)
      .json({ error: "Failed to delete news", details: error.message });
  }
});

// Get Hero
app.get("/api/hero", async (req, res) => {
  const hero = await prisma.hero.findFirst();
  res.json(hero);
});

// Update Hero
app.put("/api/hero/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { welcomeMessage, description } = req.body;

  try {
    // Ambil data hero lama
    const existingHero = await prisma.hero.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingHero) {
      return res.status(404).json({ error: "Hero not found" });
    }

    // Jika ada file baru, simpan ke local storage
    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);

      // Hapus file lama jika ada
      if (existingHero.image) {
        await deleteLocalFile(existingHero.image);
      }
    }

    // Perbarui data hero di database
    const updatedHero = await prisma.hero.update({
      where: { id: parseInt(id) },
      data: {
        welcomeMessage,
        description,
        image: newImage || existingHero.image,
      },
    });

    res.json(updatedHero);
  } catch (error) {
    console.error("Error updating hero:", error);
    res
      .status(500)
      .json({ error: "Failed to update hero", details: error.message });
  }
});

// Get all extracurriculars
app.get("/api/extracurriculars", async (req, res) => {
  const extracurriculars = await prisma.extracurricular.findMany();
  res.json(extracurriculars);
});

// Get extracurricular by ID
app.get("/api/extracurriculars/:id", async (req, res) => {
  const { id } = req.params;
  const extracurricular = await prisma.extracurricular.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(extracurricular);
});

// Add extracurricular with image upload
app.post("/api/extracurriculars", upload.single("image"), async (req, res) => {
  const { name, description } = req.body;

  try {
    const image = req.file ? getLocalFileUrl(req.file.filename) : null;

    const newExtracurricular = await prisma.extracurricular.create({
      data: {
        name,
        description,
        image,
      },
    });
    res.json(newExtracurricular);
  } catch (error) {
    console.error("Error creating extracurricular:", error);
    res
      .status(500)
      .json({ error: "Failed to create extracurricular", details: error.message });
  }
});

// Update extracurricular with image upload
app.put("/api/extracurriculars/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Fetch existing extracurricular
    const existingExtracurricular = await prisma.extracurricular.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExtracurricular) {
      return res.status(404).json({ error: "Extracurricular not found" });
    }

    // If new file is uploaded, handle image update
    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);

      // Delete old image file if it exists
      if (existingExtracurricular.image) {
        await deleteLocalFile(existingExtracurricular.image);
      }
    }

    // Update extracurricular data
    const updatedExtracurricular = await prisma.extracurricular.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        image: newImage || existingExtracurricular.image,
      },
    });

    res.json(updatedExtracurricular);
  } catch (error) {
    console.error("Error updating extracurricular:", error);
    res
      .status(500)
      .json({ error: "Failed to update extracurricular", details: error.message });
  }
});

// Delete extracurricular by ID
app.delete("/api/extracurriculars/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch existing extracurricular
    const existingExtracurricular = await prisma.extracurricular.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExtracurricular) {
      return res.status(404).json({ error: "Extracurricular not found" });
    }

    // Delete associated image file if it exists
    if (existingExtracurricular.image) {
      await deleteLocalFile(existingExtracurricular.image);
    }

    // Delete extracurricular from database
    await prisma.extracurricular.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting extracurricular:", error);
    res
      .status(500)
      .json({ error: "Failed to delete extracurricular", details: error.message });
  }
});

// Get Kalender
app.get("/api/kalender", async (req, res) => {
  const kalender = await prisma.kalender.findMany();
  res.json(kalender);
});

// Update Kalender
app.put("/api/kalender/:id", upload.single("file"), async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  try {
    const existingKalender = await prisma.kalender.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingKalender) {
      return res.status(404).json({ error: "Kalender event not found" });
    }

    let newFile = existingKalender.file;

    if (req.file) {
      newFile = getLocalFileUrl(req.file.filename);
      if (existingKalender.file) {
        await deleteLocalFile(existingKalender.file);
      }
    }

    const updatedKalender = await prisma.kalender.update({
      where: { id: parseInt(id) },
      data: {
        title,
        file: newFile,
      },
    });

    res.json(updatedKalender);
  } catch (error) {
    console.error("Error updating kalender:", error);
    res.status(500).json({ error: "Failed to update kalender", details: error.message });
  }
});

// Get all alumni
app.get("/api/alumni", async (req, res) => {
  const alumni = await prisma.alumni.findMany();
  res.json(alumni);
});

// Get alumni by ID
app.get("/api/alumni/:id", async (req, res) => {
  const { id } = req.params;
  const alumniItem = await prisma.alumni.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(alumniItem);
});

// Add alumni with image upload
app.post("/api/alumni", upload.single("image"), async (req, res) => {
  const { title, description } = req.body;

  try {
    const image = req.file ? getLocalFileUrl(req.file.filename) : null;

    const newAlumni = await prisma.alumni.create({
      data: {
        title,
        description,
        image,
      },
    });
    res.json(newAlumni);
  } catch (error) {
    console.error("Error creating alumni:", error);
    res.status(500).json({ error: "Failed to create alumni", details: error.message });
  }
});

// Update alumni with image upload
app.put("/api/alumni/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const existingAlumni = await prisma.alumni.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingAlumni) {
      return res.status(404).json({ error: "Alumni not found" });
    }

    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);

      // Delete the old image file from the server
      if (existingAlumni.image) {
        await deleteLocalFile(existingAlumni.image);
      }
    }

    const updatedAlumni = await prisma.alumni.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        image: newImage || existingAlumni.image,
      },
    });
    res.json(updatedAlumni);
  } catch (error) {
    console.error("Error updating alumni:", error);
    res.status(500).json({ error: "Failed to update alumni", details: error.message });
  }
});

// Delete alumni by ID
app.delete("/api/alumni/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existingAlumni = await prisma.alumni.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingAlumni) {
      return res.status(404).json({ error: "Alumni not found" });
    }

    // Delete the file associated with the alumni from local storage
    if (existingAlumni.image) {
      await deleteLocalFile(existingAlumni.image);
    }

    await prisma.alumni.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting alumni:", error);
    res.status(500).json({ error: "Failed to delete alumni", details: error.message });
  }
});

// Get all galeri
app.get("/api/galeri", async (req, res) => {
  const galeri = await prisma.galeri.findMany();
  res.json(galeri);
});

// Get galeri by ID
app.get("/api/galeri/:id", async (req, res) => {
  const { id } = req.params;
  const galeriItem = await prisma.galeri.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(galeriItem);
});

// Add galeri with local image upload
app.post("/api/galeri", upload.single("image"), async (req, res) => {
  const { title } = req.body;

  try {
    const image = req.file ? getLocalFileUrl(req.file.filename) : null;

    const newGaleri = await prisma.galeri.create({
      data: {
        title,
        image,
      },
    });
    res.json(newGaleri);
  } catch (error) {
    console.error("Error creating galeri:", error);
    res
      .status(500)
      .json({ error: "Failed to create galeri", details: error.message });
  }
});

// Update galeri with local image upload
app.put("/api/galeri/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  try {
    const existingGaleri = await prisma.galeri.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingGaleri) {
      return res.status(404).json({ error: "Galeri not found" });
    }

    let newImage = existingGaleri.image;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);
      if (existingGaleri.image) {
        await deleteLocalFile(existingGaleri.image);
      }
    }

    const updatedGaleri = await prisma.galeri.update({
      where: { id: parseInt(id) },
      data: {
        title,
        image: newImage,
      },
    });

    res.json(updatedGaleri);
  } catch (error) {
    console.error("Error updating galeri:", error);
    res
      .status(500)
      .json({ error: "Failed to update galeri", details: error.message });
  }
});

// Delete galeri by ID
app.delete("/api/galeri/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existingGaleri = await prisma.galeri.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingGaleri) {
      return res.status(404).json({ error: "Galeri not found" });
    }

    if (existingGaleri.image) {
      await deleteLocalFile(existingGaleri.image);
    }

    await prisma.galeri.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting galeri:", error);
    res
      .status(500)
      .json({ error: "Failed to delete galeri", details: error.message });
  }
});

app.get("/api/sarana", async (req, res) => {
  const sarana = await prisma.sarana.findMany();
  res.json(sarana);
});

app.get("/api/sarana/:id", async (req, res) => {
  const { id } = req.params;
  const saranaItem = await prisma.sarana.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(saranaItem);
});

app.post("/api/sarana", upload.single("image"), async (req, res) => {
  const { name, description } = req.body;

  try {
    const image = req.file ? getLocalFileUrl(req.file.filename) : null;

    const newSarana = await prisma.sarana.create({
      data: {
        name,
        description,
        image,
      },
    });
    res.json(newSarana);
  } catch (error) {
    console.error("Error creating sarana:", error);
    res.status(500).json({ error: "Failed to create sarana", details: error.message });
  }
});

app.put("/api/sarana/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const existingSarana = await prisma.sarana.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingSarana) {
      return res.status(404).json({ error: "Sarana not found" });
    }

    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);
      if (existingSarana.image) {
        await deleteLocalFile(existingSarana.image);
      }
    }

    const updatedSarana = await prisma.sarana.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        image: newImage || existingSarana.image,
      },
    });
    res.json(updatedSarana);
  } catch (error) {
    console.error("Error updating sarana:", error);
    res.status(500).json({ error: "Failed to update sarana", details: error.message });
  }
});

app.delete("/api/sarana/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existingSarana = await prisma.sarana.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingSarana) {
      return res.status(404).json({ error: "Sarana not found" });
    }

    if (existingSarana.image) {
      await deleteLocalFile(existingSarana.image);
    }

    await prisma.sarana.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting sarana:", error);
    res.status(500).json({ error: "Failed to delete sarana", details: error.message });
  }
});

// Get Headmaster Message
app.get("/api/headmaster-message", async (req, res) => {
  const headmasterMessage = await prisma.headmasterMessage.findFirst();
  res.json(headmasterMessage);
});

// Update Headmaster Message
app.put("/api/headmaster-message/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { message, description, headmasterName } = req.body;

  try {
    // Ambil data Headmaster Message lama
    const existingMessage = await prisma.headmasterMessage.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingMessage) {
      return res.status(404).json({ error: "Headmaster Message not found" });
    }

    // Jika ada gambar baru, unggah ke penyimpanan lokal
    let newImage = null;
    if (req.file) {
      newImage = getLocalFileUrl(req.file.filename);

      // Hapus gambar lama dari penyimpanan lokal jika ada
      if (existingMessage.image) {
        await deleteLocalFile(existingMessage.image);
      }
    }

    // Perbarui Headmaster Message
    const updatedHeadmasterMessage = await prisma.headmasterMessage.update({
      where: { id: parseInt(id) },
      data: {
        message,
        description,
        image: newImage || existingMessage.image, // Gunakan gambar baru jika ada
        headmasterName,
      },
    });

    res.json(updatedHeadmasterMessage);
  } catch (error) {
    console.error("Error updating headmaster message:", error);
    res.status(500).json({ error: "Failed to update headmaster message" });
  }
});

// Get all Sejarah slides
app.get("/api/sejarah", async (req, res) => {
  const sejarah = await prisma.sejarah.findMany();
  res.json(sejarah);
});

// Create a new Sejarah slide
app.post("/api/sejarah", upload.single("image"), async (req, res) => {
  const { period, text } = req.body;
  let imageUrl = null;
  if (req.file) {
    imageUrl = getLocalFileUrl(req.file.filename);
  }
  const newSejarah = await prisma.sejarah.create({
    data: { period, text, image: imageUrl },
  });
  res.json(newSejarah);
});

// Update Sejarah slide
app.put("/api/sejarah/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { period, text } = req.body;
  const existingSejarah = await prisma.sejarah.findUnique({
    where: { id: parseInt(id) },
  });
  if (!existingSejarah) {
    return res.status(404).json({ error: "Sejarah not found" });
  }
  let imageUrl = existingSejarah.image;
  if (req.file) {
    imageUrl = getLocalFileUrl(req.file.filename);
    if (existingSejarah.image) {
      await deleteLocalFile(existingSejarah.image);
    }
  }
  const updatedSejarah = await prisma.sejarah.update({
    where: { id: parseInt(id) },
    data: { period, text, image: imageUrl },
  });
  res.json(updatedSejarah);
});

// Delete Sejarah slide
app.delete("/api/sejarah/:id", async (req, res) => {
  const { id } = req.params;
  const existingSejarah = await prisma.sejarah.findUnique({
    where: { id: parseInt(id) },
  });
  if (!existingSejarah) {
    return res.status(404).json({ error: "Sejarah not found" });
  }
  // Hapus file gambar dari penyimpanan lokal jika ada
  if (existingSejarah.image) {
    await deleteLocalFile(existingSejarah.image);
  }
  await prisma.sejarah.delete({
    where: { id: parseInt(id) },
  });
  res.json({ message: "Slide sejarah berhasil dihapus" });
});

// Get Visi Misi
app.get("/api/visi-misi", async (req, res) => {
  const visiMisi = await prisma.visiMisi.findFirst();
  res.json(visiMisi);
});

// Update Visi Misi
app.put("/api/visi-misi/:id", async (req, res) => {
  const { id } = req.params;
  const { visi, misi } = req.body;

  const updatedVisiMisi = await prisma.visiMisi.update({
    where: { id: parseInt(id) },
    data: {
      visi,
      misi,
    },
  });

  res.json(updatedVisiMisi);
});

app.get("/api/schoolinfo", async (req, res) => {
  const schoolInfo = await prisma.schoolInfo.findFirst();
  if (!schoolInfo) {
    return res.status(404).json({ message: "School information not found" });
  }
  res.json(schoolInfo);
});

// Update SchoolInfo
app.put("/api/schoolinfo/:id", async (req, res) => {
  const { id } = req.params;
  const {
    akreditasi,
    jumlahGuru,
    tenagaPendidikan,
    jumlahSiswa,
    namaSekolah,
    nspn,
    jenjangPendidikan,
    statusSekolah,
    alamat,
    rtRw,
    kodePos,
    kecamatan,
    kabKota,
    provinsi,
    negara,
    posisiGeografis,
  } = req.body;

  const updatedSchoolInfo = await prisma.schoolInfo.update({
    where: { id: parseInt(id) },
    data: {
      akreditasi,
      jumlahGuru,
      tenagaPendidikan,
      jumlahSiswa,
      namaSekolah,
      nspn,
      jenjangPendidikan,
      statusSekolah,
      alamat,
      rtRw,
      kodePos,
      kecamatan,
      kabKota,
      provinsi,
      negara,
      posisiGeografis,
    },
  });

  res.json(updatedSchoolInfo);
});

// Endpoint untuk mendapatkan strukturOrganisasi
app.get("/api/strukturOrganisasi", async (req, res) => {
  try {
    const strukturOrganisasi = await prisma.strukturOrganisasi.findMany();
    res.json(strukturOrganisasi);
  } catch (error) {
    console.error("Failed to fetch struktur organisasi:", error);
    res.status(500).json({ error: "Failed to fetch struktur organisasi" });
  }
});

// Add Struktur Organisasi with image upload
app.post("/api/strukturOrganisasi", upload.single("image"), async (req, res) => {
  const { role, name } = req.body;
  const image = req.file ? await uploadToSupabase(req.file) : null;

  try {
    const newPerson = await prisma.strukturOrganisasi.create({
      data: {
        role,
        name,
        image,
      },
    });
    res.json(newPerson);
  } catch (error) {
    console.error("Failed to create struktur organisasi:", error);
    res.status(500).json({ error: "Failed to create struktur organisasi" });
  }
});

// Update Struktur Organisasi with image upload
app.put("/api/strukturOrganisasi/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { role, name } = req.body;
  let newImage = null;

  try {
    const existingPerson = await prisma.strukturOrganisasi.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingPerson) {
      return res.status(404).json({ error: "Struktur Organisasi not found" });
    }

    // If a new file is uploaded, delete the old one
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingPerson.image) {
        await deleteFromSupabase(existingPerson.image);
      }
    }

    const updatedPerson = await prisma.strukturOrganisasi.update({
      where: { id: parseInt(id) },
      data: {
        role,
        name,
        image: newImage || existingPerson.image, // Use new image or keep old one
      },
    });
    res.json(updatedPerson);
  } catch (error) {
    console.error("Failed to update struktur organisasi:", error);
    res.status(500).json({ error: "Failed to update struktur organisasi" });
  }
});

// Delete Struktur Organisasi and its image from Supabase
app.delete("/api/strukturOrganisasi/:id", async (req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id); // Ensure id is an integer
  if (isNaN(parsedId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const existingPerson = await prisma.strukturOrganisasi.findUnique({
      where: { id: parsedId },
    });

    if (!existingPerson) {
      return res.status(404).json({ error: "Struktur Organisasi not found" });
    }

    // Delete the file associated with the person from Supabase if exists
    if (existingPerson.image) {
      await deleteFromSupabase(existingPerson.image);
    }

    // Delete the structure from the database
    await prisma.strukturOrganisasi.delete({
      where: { id: parsedId },
    });

    res.status(204).send(); // Successfully deleted
  } catch (error) {
    console.error("Failed to delete struktur organisasi with id:", parsedId, error);
    res.status(500).send("Error deleting struktur organisasi");
  }
});

// Create new staff or teacher
app.post("/api/staffandteachers", upload.single("image"), async (req, res) => {
  const { name, role } = req.body;
  const image = req.file ? await uploadToSupabase(req.file) : null;  // Upload to Supabase

  try {
    const newStaffAndTeacher = await prisma.staffAndTeacher.create({
      data: {
        name,
        role,
        image,  // Save the Supabase image URL
      },
    });
    res.status(201).json(newStaffAndTeacher);
  } catch (error) {
    console.error("Error creating staff or teacher:", error);
    res.status(500).json({ error: "Failed to create staff or teacher" });
  }
});

// Get all staff and teachers
app.get("/api/staffandteachers", async (req, res) => {
  const staffAndTeachers = await prisma.staffAndTeacher.findMany();
  res.json(staffAndTeachers);
});

// Get staff and teacher by ID
app.get("/api/staffandteachers/:id", async (req, res) => {
  const { id } = req.params;
  const staffAndTeacher = await prisma.staffAndTeacher.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(staffAndTeacher);
});

// Update staff and teacher
app.put("/api/staffandteachers/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  try {
    // Get the existing staff/teacher data
    const existingStaffAndTeacher = await prisma.staffAndTeacher.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStaffAndTeacher) {
      return res.status(404).json({ error: "Staff or teacher not found" });
    }

    let newImage = existingStaffAndTeacher.image;

    // If there's a new image, upload it and delete the old one
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      // Delete the old image from Supabase
      if (existingStaffAndTeacher.image) {
        await deleteFromSupabase(existingStaffAndTeacher.image);
      }
    }

    // Update the staff/teacher record
    const updatedStaffAndTeacher = await prisma.staffAndTeacher.update({
      where: { id: parseInt(id) },
      data: {
        name,
        role,
        image: newImage,  // Set the new image or keep the old one
      },
    });

    res.json(updatedStaffAndTeacher);
  } catch (error) {
    console.error("Error updating staff or teacher:", error);
    res.status(500).json({ error: "Failed to update staff or teacher" });
  }
});

// Delete staff or teacher
app.delete("/api/staffandteachers/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Get the existing staff/teacher data
    const existingStaffAndTeacher = await prisma.staffAndTeacher.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStaffAndTeacher) {
      return res.status(404).json({ error: "Staff or teacher not found" });
    }

    // Delete the image from Supabase if it exists
    if (existingStaffAndTeacher.image) {
      await deleteFromSupabase(existingStaffAndTeacher.image);
    }

    // Delete the staff/teacher record
    await prisma.staffAndTeacher.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();  // Respond with no content
  } catch (error) {
    console.error("Error deleting staff or teacher:", error);
    res.status(500).json({ error: "Failed to delete staff or teacher" });
  }
});

// Create a new contact message
app.post("/api/contacts", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    const newContact = await prisma.contact.create({
      data: {
        name,
        email,
        phone,
        message,
      },
    });
    res.status(201).json(newContact);
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ error: "Failed to create contact message" });
  }
});

// Get all contact messages
app.get("/api/contacts", async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany();
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Failed to fetch contact messages" });
  }
});

// Backend: Delete a contact message by ID
app.delete("/api/contacts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the contact message by its ID
    const deletedContact = await prisma.contact.delete({
      where: { id: parseInt(id) }, // Assuming id is an integer
    });
    res.status(200).json(deletedContact);
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(404).json({ error: "Contact not found or failed to delete" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
