import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const BUCKET_NAME = "uploads"; // Replace with your Supabase storage bucket name

// Configure multer (no need for local disk storage)
const upload = multer({ storage: multer.memoryStorage() });

// Upload file to Supabase
const uploadToSupabase = async (file) => {
  const uniqueFilename = `${Date.now()}-${file.originalname}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(uniqueFilename, file.buffer, {
      contentType: file.mimetype,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error("Failed to upload file to Supabase");
  }

  // Dapatkan URL publik
  return supabase.storage.from(BUCKET_NAME).getPublicUrl(uniqueFilename).data
    .publicUrl;
};

// Hapus file dari Supabase
const deleteFromSupabase = async (fileUrl) => {
  const filePath = fileUrl.replace(
    `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`,
    ""
  );
  console.log("File Path to be deleted:", filePath);
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    console.error("Supabase delete error:", error);
    throw new Error("Failed to delete file from Supabase");
  }
};

// Endpoint untuk memastikan server berjalan
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
    const image = req.file ? await uploadToSupabase(req.file) : null;

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
    // Ambil data berita lama
    const existingNews = await prisma.news.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNews) {
      return res.status(404).json({ error: "News not found" });
    }

    // Jika ada file baru, upload dan hapus file lama dari Supabase
    let newImage = null;
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingNews.image) {
        await deleteFromSupabase(existingNews.image);
      }
    }

    // Perbarui data berita
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
    // Ambil data berita lama
    const existingNews = await prisma.news.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNews) {
      return res.status(404).json({ error: "News not found" });
    }

    // Hapus file terkait dari Supabase jika ada
    if (existingNews.image) {
      await deleteFromSupabase(existingNews.image);
    }

    // Hapus data berita dari database
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

app.post("/api/announcements", async (req, res) => {
  const { title, description, publishedDate } = req.body;

  // Validate date format
  if (
    !title ||
    !description ||
    !publishedDate ||
    isNaN(new Date(publishedDate).getTime())
  ) {
    return res.status(400).json({ error: "Invalid or missing fields" });
  }

  try {
    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        description,
        publishedDate: new Date(publishedDate),
      },
    });
    res.json(newAnnouncement);
  } catch (error) {
    console.error("Failed to create announcement:", error);
    res.status(500).send("Error creating announcement");
  }
});

// Update announcement by ID
app.put("/api/announcements/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, publishedDate } = req.body;

  if (!title || !description || !publishedDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let parsedDate = null;
  if (publishedDate && !isNaN(new Date(publishedDate).getTime())) {
    parsedDate = new Date(publishedDate);
  }

  try {
    const updatedAnnouncement = await prisma.announcement.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        publishedDate: parsedDate,
      },
    });
    res.json(updatedAnnouncement);
  } catch (error) {
    console.error("Failed to update announcement:", error);
    res.status(500).json({ error: "Error updating announcement" });
  }
});

// Get all announcements
app.get("/api/announcements", async (req, res) => {
  const announcements = await prisma.announcement.findMany();
  res.json(announcements);
});

// Get announcement by ID
app.get("/api/announcements/:id", async (req, res) => {
  const { id } = req.params;
  const announcement = await prisma.announcement.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(announcement);
});

// Delete announcement by ID
app.delete("/api/announcements/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.announcement.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    res.status(500).send("Error deleting announcement");
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

    // Jika ada file baru, upload dan hapus file lama dari Supabase
    let newImage = null;
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingHero.image) {
        await deleteFromSupabase(existingHero.image);
      }
    }

    // Perbarui data hero
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
    const image = req.file ? await uploadToSupabase(req.file) : null;

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
    // Ambil data lama
    const existingExtracurricular = await prisma.extracurricular.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExtracurricular) {
      return res.status(404).json({ error: "Extracurricular not found" });
    }

    // Jika ada file baru, upload dan hapus file lama
    let newImage = null;
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingExtracurricular.image) {
        await deleteFromSupabase(existingExtracurricular.image);
      }
    }

    // Perbarui data
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
    // Ambil data lama
    const existingExtracurricular = await prisma.extracurricular.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExtracurricular) {
      return res.status(404).json({ error: "Extracurricular not found" });
    }

    // Hapus file terkait dari Supabase jika ada
    if (existingExtracurricular.image) {
      await deleteFromSupabase(existingExtracurricular.image);
    }

    // Hapus data dari database
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
  const file = req.file ? `/uploads/${req.file.filename}` : null;

  const updatedKalender = await prisma.kalender.update({
    where: { id: parseInt(id) },
    data: {
      title,
      file: file || undefined,
    },
  });

  res.json(updatedKalender);
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
    const image = req.file ? await uploadToSupabase(req.file) : null;

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
    res
      .status(500)
      .json({ error: "Failed to create alumni", details: error.message });
  }
});

// Update alumni with image upload
app.put("/api/alumni/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    // Ambil data alumni lama
    const existingAlumni = await prisma.alumni.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingAlumni) {
      return res.status(404).json({ error: "Alumni not found" });
    }

    // Jika ada file baru, upload dan hapus file lama dari Supabase
    let newImage = null;
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingAlumni.image) {
        await deleteFromSupabase(existingAlumni.image);
      }
    }

    // Perbarui data alumni
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
    res
      .status(500)
      .json({ error: "Failed to update alumni", details: error.message });
  }
});

// Delete alumni by ID
app.delete("/api/alumni/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Ambil data alumni lama
    const existingAlumni = await prisma.alumni.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingAlumni) {
      return res.status(404).json({ error: "Alumni not found" });
    }

    // Hapus file terkait dari Supabase jika ada
    if (existingAlumni.image) {
      await deleteFromSupabase(existingAlumni.image);
    }

    // Hapus data alumni dari database
    await prisma.alumni.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting alumni:", error);
    res
      .status(500)
      .json({ error: "Failed to delete alumni", details: error.message });
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

// Add galeri with image upload
app.post("/api/galeri", upload.single("image"), async (req, res) => {
  const { title } = req.body;

  try {
    const image = req.file ? await uploadToSupabase(req.file) : null;

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

// Update galeri with image upload
app.put("/api/galeri/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  try {
    // Fetch existing galeri
    const existingGaleri = await prisma.galeri.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingGaleri) {
      return res.status(404).json({ error: "Galeri not found" });
    }

    // Handle new image upload and delete old file
    let newImage = null;
    if (req.file) {
      newImage = await uploadToSupabase(req.file);

      if (existingGaleri.image) {
        await deleteFromSupabase(existingGaleri.image);
      }
    }

    // Update galeri data
    const updatedGaleri = await prisma.galeri.update({
      where: { id: parseInt(id) },
      data: {
        title,
        image: newImage || existingGaleri.image,
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
    // Fetch existing galeri
    const existingGaleri = await prisma.galeri.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingGaleri) {
      return res.status(404).json({ error: "Galeri not found" });
    }

    // Delete file from Supabase if exists
    if (existingGaleri.image) {
      await deleteFromSupabase(existingGaleri.image);
    }

    // Delete galeri record from database
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

// Get all sarana
app.get("/api/sarana", async (req, res) => {
  const sarana = await prisma.sarana.findMany();
  res.json(sarana);
});

// Get sarana by ID
app.get("/api/sarana/:id", async (req, res) => {
  const { id } = req.params;
  const saranaItem = await prisma.sarana.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(saranaItem);
});

// Add sarana with image upload
app.post("/api/sarana", upload.single("image"), async (req, res) => {
  const { name, description } = req.body;

  try {
    const image = req.file ? await uploadToSupabase(req.file) : null;

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
    res
      .status(500)
      .json({ error: "Failed to create sarana", details: error.message });
  }
});

// Update sarana with image upload
app.put("/api/sarana/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Ambil data sarana lama
    const existingSarana = await prisma.sarana.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingSarana) {
      return res.status(404).json({ error: "Sarana not found" });
    }

    // Jika ada file baru, upload dan hapus file lama dari Supabase
    let newImage = null;
    if (req.file) {
      // Unggah file baru
      newImage = await uploadToSupabase(req.file);

      // Hapus file lama jika ada
      if (existingSarana.image) {
        await deleteFromSupabase(existingSarana.image);
      }
    }

    // Perbarui data sarana
    const updatedSarana = await prisma.sarana.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        image: newImage || existingSarana.image, // Gunakan gambar baru atau gambar lama
      },
    });
    res.json(updatedSarana);
  } catch (error) {
    console.error("Error updating sarana:", error);
    res.status(500).json({ error: "Failed to update sarana", details: error.message });
  }
});

// Delete sarana by ID
app.delete("/api/sarana/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Ambil data sarana lama
    const existingSarana = await prisma.sarana.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingSarana) {
      return res.status(404).json({ error: "Sarana not found" });
    }

    // Hapus file terkait dari Supabase jika ada
    if (existingSarana.image) {
      await deleteFromSupabase(existingSarana.image);
    }

    // Hapus data sarana dari database
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
app.put(
  "/api/headmaster-message/:id",
  upload.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { message, description, headmasterName } = req.body;

    let image = null;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    try {
      const updatedHeadmasterMessage = await prisma.headmasterMessage.update({
        where: { id: parseInt(id) },
        data: {
          message,
          description,
          image: image || undefined,
          headmasterName,
        },
      });
      res.json(updatedHeadmasterMessage);
    } catch (error) {
      console.error("Error updating headmaster message:", error);
      res.status(500).json({ error: "Failed to update headmaster message" });
    }
  }
);

// Get Sejarah
app.get("/api/sejarah", async (req, res) => {
  const sejarah = await prisma.sejarah.findFirst();
  res.json(sejarah);
});

// Update Sejarah
app.put("/api/sejarah/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const updatedSejarah = await prisma.sejarah.update({
    where: { id: parseInt(id) },
    data: {
      text,
      image: image || undefined,
    },
  });

  res.json(updatedSejarah);
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

app.get("/api/strukturOrganisasi", async (req, res) => {
  try {
    const strukturOrganisasi = await prisma.strukturOrganisasi.findMany();
    res.json(strukturOrganisasi);
  } catch (error) {
    console.error("Failed to fetch struktur organisasi:", error);
    res.status(500).json({ error: "Failed to fetch struktur organisasi" });
  }
});

app.post(
  "/api/strukturOrganisasi",
  upload.single("image"),
  async (req, res) => {
    const { role, name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

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
  }
);

app.put(
  "/api/strukturOrganisasi/:id",
  upload.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { role, name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    try {
      const updatedPerson = await prisma.strukturOrganisasi.update({
        where: { id: parseInt(id) },
        data: {
          role,
          name,
          image: image || undefined,
        },
      });
      res.json(updatedPerson);
    } catch (error) {
      console.error("Failed to update struktur organisasi:", error);
      res.status(500).json({ error: "Failed to update struktur organisasi" });
    }
  }
);

app.delete("/api/strukturOrganisasi/:id", async (req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id); // Ensure id is an integer
  if (isNaN(parsedId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    await prisma.strukturOrganisasi.delete({
      where: { id: parsedId },
    });
    res.status(204).send();
  } catch (error) {
    console.error(
      "Failed to delete struktur organisasi with id:",
      parsedId,
      error
    );
    res.status(500).send("Error deleting struktur organisasi");
  }
});

// Create new staff or teacher
app.post("/api/staffandteachers", upload.single("image"), async (req, res) => {
  const { name, role } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const newStaffAndTeacher = await prisma.staffAndTeacher.create({
      data: {
        name,
        role,
        image,
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
app.put(
  "/api/staffandteachers/:id",
  upload.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { name, role } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const updatedStaffAndTeacher = await prisma.staffAndTeacher.update({
      where: { id: parseInt(id) },
      data: {
        name,
        role,
        image: image || undefined,
      },
    });

    res.json(updatedStaffAndTeacher);
  }
);

// Delete staff or teacher
app.delete("/api/staffandteachers/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.staffAndTeacher.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send(); // Respond with no content
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
