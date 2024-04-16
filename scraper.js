const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
require('dotenv').config();

const receiveEmail = process.env.RECEIVE_EMAIL;
const today = new Date();

async function scrapeAndSendEmail() {
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--single-process',
            '--no-zygote',
        ],
        executablePath: process.env.NODE_ENV === 'production' 
            ? process.env.PUPPETEER_EXECUTABLE_PATH 
            : puppeteer.executablePath(),
    });
    const page = await browser.newPage();
    
    // Load the search page
    await page.goto('http://clerk.house.gov/public_disc/financial-search.aspx');

    // Fill in the "Last Name" and select the "Filing Year"
    await page.type('#LastName', 'Pelosi');

    // Adjust the selector and value according to the actual options available
    const currentYear = (new Date().getFullYear()).toString();
    await page.select('#FilingYear', currentYear);

    // Click the "Search" button
    await page.click('button[aria-label="search button"]');
    
    // Wait for search results to load
    await page.waitForSelector('#DataTables_Table_0_wrapper');

    // Scrape the PDF links
    let pdfLinks = [];

    const links = await page.evaluate(() => {
        // Selecting all <a> tags inside any td with class 'memberName'
        const anchors = Array.from(document.querySelectorAll('td.memberName a')); 

        // Extracting the href from each <a> tag
        return anchors.map(anchor => anchor.href);
    });

    await links.forEach(link => pdfLinks.push(link));
    
    await browser.close();

    // Send the collected links via email
    sendEmail(pdfLinks);
}

function sendEmail(pdfLinks) {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        type: "SMTP",
        host: "smtp.gmail.com",
        secure: true,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD,
        }
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to: receiveEmail,
        subject: `Nancy Pelosi Financial Disclosure ${today.getFullYear()} (${pdfLinks.length})`,
        text: 'Here are the PDF links:\n' + pdfLinks.join('\n\n')
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

scrapeAndSendEmail();