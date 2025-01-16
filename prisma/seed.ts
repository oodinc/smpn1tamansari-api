import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.hero.createMany({
    data: [
      {
        welcomeMessage: 'SMPN 1 Tamansari',
        description: 'lorem ipsum dolor sit amet',
        image: 'hero_image_url_1',
      },
    ],
  });

  await prisma.kalender.createMany({
    data: [
      {
        title: "2025",
        file: "/files/kalender-2025.pdf",
      }
    ],
  });

  await prisma.headmasterMessage.create({
    data: {
      message: 'Selamat datang di tahun ajaran baru! Semoga kita semua dapat belajar dan berkembang bersama.',
      description: 'Pesan motivasi dari Kepala Sekolah untuk mengawali tahun ajaran baru.',
      image: 'https://example.com/path/to/image.jpg',
      headmasterName: 'Dr. John Doe',
    },
  });

  await prisma.sejarah.create({
    data: {
      text: "Sejarah peradaban Mesir Kuno dimulai lebih dari 5000 tahun yang lalu, dikenal dengan piramida dan Sphinx.",
      image: "https://example.com/mesir-kuno.jpg",
    },
  });

  await prisma.visiMisi.create({
    data: {
      visi: "Menjadi perusahaan terdepan dalam inovasi teknologi dan solusi berbasis kecerdasan buatan.",
      misi: [
        "Mengembangkan produk yang bermanfaat untuk masyarakat.",
        "Menciptakan ekosistem yang mendukung pertumbuhan digital.",
        "Meningkatkan kualitas layanan melalui riset dan pengembangan.",
      ],
    },
  });

  await prisma.schoolInfo.create({
    data: {
      akreditasi: "A",
      jumlahGuru: 45,
      tenagaPendidikan: 12,
      jumlahSiswa: 500,
      namaSekolah: "SMA Negeri 1 Jakarta",
      nspn: "123456789",
      jenjangPendidikan: "Sekolah Menengah Atas",
      statusSekolah: "Negeri",
      alamat: "Jl. Merdeka No. 10",
      rtRw: "03/02",
      kodePos: "10120",
      kecamatan: "Menteng",
      kabKota: "Jakarta Pusat",
      provinsi: "DKI Jakarta",
      negara: "Indonesia",
      posisiGeografis: "6.1745° S, 106.8299° E",
    },
  });

  console.log("Seed data berhasil ditambahkan!");
}

main()
  .catch((e) => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
